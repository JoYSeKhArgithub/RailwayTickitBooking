import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";
import { config } from "../config/root.js";
import { inventoryProducer, inventroyProducer } from "../kafka/inventoryProducer/index.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../utils/error.js";
import { retryTransaction, retryTransactrion } from "../utils/retryTransaction.js";

const recomputeSegmentSeatStatus = async (tx, scheduleId, seatIds)=>{
    const statusChanges = {nowAvailable: 0,nowOccupied: 0,lockedToBooked: 0,bookedToLocked: 0};

    for(const seatId of seatIds){
        const locks = await tx.seatSegmentLock.findMany({
            where: {scheduleId,seatId,status: {in: ['LOCKED','BOOKED']}},
            select: {status: true}
        });

        let newStatus;
        if(locks.length === 0){
            newStatus = 'AVAILABLE';
        }else if(locks.some(l=> l.status === 'LOCKED')){
            newStatus = 'LOCKED';
        }else{
            newStatus = 'BOOKED';
        }

        const current = await tx.$queryRaw`
            SELECT status FROM seat_inventories
            WHERE "scheduleId" = ${scheduleId} AND "seatId" = ${seatId}
            FOR UPDATE NOWAIT
        `;

        const oldStatus = current[0]?.status;

        if(oldStatus === newStatus) continue;

        if (oldStatus === 'AVAILABLE' && newStatus !== 'AVAILABLE') statusChanges.nowOccupied++;
        if (oldStatus !== 'AVAILABLE' && newStatus === 'AVAILABLE') statusChanges.nowAvailable++;
        if (oldStatus === 'LOCKED' && newStatus === 'BOOKED') statusChanges.lockedToBooked++;
        if(oldStatus === 'BOOKED' && newStatus === 'LOCKED') statusChanges.bookedToLocked++;


        await tx.$executeRaw`
               UPDATE seat_inventories
               SET status = ${newStatus}::"SeatStatus",
                   "lockedBy" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "lockedBy" END,
                   "lockedAt" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "lockedAt" END,
                   "lockExpiresAt" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "lockExpiresAt" END,
                   "bookingId" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "bookingId" END,
                   version = version + 1, "updatedAt" = NOW()
               WHERE "scheduleId" = ${scheduleId} AND "seatId" = ${seatId}
          `;
    }
    return statusChanges;
}

const recountScheduleAggregates = async(tx,scheduleId)=>{
    const counts = await tx.$queryRaw`
          SELECT
               COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int AS available,
               COUNT(*) FILTER (WHERE status = 'LOCKED')::int AS locked,
               COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked
          FROM seat_inventories
          WHERE "scheduleId" = ${scheduleId}
     `;

    const { available, locked, booked } = counts[0];

    await tx.$executeRaw`
          UPDATE schedule_inventories
          SET available = ${available}, locked = ${locked}, booked = ${booked},
              version = version + 1, "updatedAt" = NOW()
          WHERE "scheduleId" = ${scheduleId}
     `;

    return { available, locked, booked };
}

const initializeInventory = async(eventData)=>{
    const data = eventData?.data || eventData || {};
    const {scheduleId, trainId, trainNumber, trainName, departureDate, seats, route} = data;
    if(!scheduleId || !seats || !seats.length){
        logger.warn('Invalid scheduleId or in the schedule seats are missing');
        return;
    }
    const eventKey = `SCHEDULE_CREATED-${scheduleId}`;
    const exist = await prisma.idempotencyRecord.findUnique({
        where:{
            eventKey
        }
    })
    if(exist){
        logger.warn('Duplicate schedule cannot be created');
        return;
    }

    const totalSeats = seats.length;
    await prisma.$transaction(async(tx)=>{
        const schedule = await tx.scheduleInventory.create({
            data: {
                scheduleId,
                trainId,
                trainNumber,
                trainName,
                departureDate: new Date(departureDate),
                totalSeats,
                available: totalSeats,
                locked: 0,
                booked: 0,
                status: 'ACTIVE'
            }
        })

        const seatData = seats.map((seat)=>({
            scheduleInvetoryId: schedule.id,
            scheduleId,
            seatId: seat.seatId,
            seatNumber: seat.seatNumber,
            seatType: seat.seatType,
            price: seat.price,
            status: 'AVAILABLE'
        }))

        await tx.seatInventory.createMany({
            data: seatData
        });

        if(route && route.length > 0){
            const routeStop = route.map(rs=>({
                scheduleId,
                stationId: rs.stationId,
                stationName: rs.stationName,
                stationCode: rs.stationCode,
                sequenceNumber: rs.sequenceNumber
            }));
            await tx.routeStop.createMany({
                data: routeStop
            });
            logger.info(`Persisted ${routeStop.length} route stops for schedule ${scheduleId}`)
        }

        await tx.idempotencyRecord.create({data: {
            eventKey
        }})
    });

    logger.info('Inventory service initialize for schedule created');
    try{
        await inventroyProducer.publishSeatAvailabilityUpdated(scheduleId,trainId,totalSeats,0,0);
    }catch(err){
        logger.error('Failed to publish initial availability event after retries', { scheduleId, error: err.message });
    }
}

const cancelScheduleInventory= async(eventData)=>{
    const data = eventData.data || eventData;
    const scheduleId = data.scheduleId || data.id;
    if(!scheduleId){
        logger.warn('Missing schedule id cannont proceed')
        return;
    }
    const eventKey = `SCHEDULE_CANCELLED-${scheduleId}`;
    const exist = await prisma.idempotencyRecord.findUnique({
        where: {
            eventKey
        }
    });
    if(exist){
        logger.warn('Duplicate event cannot be proceed');
        return;
    }
    const dataSchedule = await prisma.scheduleInventory.findUnique({
        where: {scheduleId}
    })
    if(!dataSchedule){
        logger.warn('There is no schedule present to cancel');
        return;
    }

    await prisma.$transaction(async(tx)=>{
        await tx.scheduleInventory.update({
            where: {
                scheduleId
            },
            data: {
                status: 'CANCELLED',
                available: 0,
                locked: 0, 
                booked: 0, 
                version: { increment: 1 }
            }
        });

        await tx.seatInventory.updateMany({
            where: {
                scheduleId
            },
            data:{
                status: 'CANCELLED',
            }
        });
        await tx.idempotencyRecord.create({data: {eventKey}})
    });
    logger.info('Inventory cancelled successfully');
    try {
        await inventoryProducer.publishSeatAvailabilityUpdated(scheduleId, dataSchedule.trainId, 0, 0, 0);
    } catch (error) {
        logger.error('Failed to publish seat availability after retries')
    }
}

const getSceduleService= async(scheduleId)=>{
    if (!scheduleId) throw new BadRequestError('Scedule Id is mandatory to get scedule');
    const schdeuleData = await prisma.scheduleInventory.findUnique({
        where:{
            scheduleId
        }
    })
    if(!schdeuleData) throw new NotFoundError('No schedule data found');
    return {
        scheduleId: schdeuleData.scheduleId,
        trainId: schdeuleData.trainId,
        trainNumber: schdeuleData.trainNumber,
        trainName: schdeuleData.trainName,
        departureDate: schdeuleData.departureDate,
        status: schdeuleData.status,
        totalSeats: schdeuleData.totalSeats,
        available: schdeuleData.available,
        locked: schdeuleData.locked,
        booked: schdeuleData.booked,
    }
}

const getScheduleSeatsService = async(scheduleId,filter={})=>{
    const data = await prisma.scheduleInventory.findUnique({
        where: {
            scheduleId
        }
    })
    if(!data) throw new NotFoundError('The train is not found for this seats');

    const where = {scheduleId};
    if(filter.seatType) where.seatType = seatType;
    if(filter.status) where.status = seatType.status;

    const seats = await prisma.seatInventory.findMany({
        where,
        orderBy: {seatNumber: 'asc'},
        select:{
            seatId: true,
            seatNumber: true,
            seatType: true,
            price: true,
            status: true,
            lockedBy: true,
            lockeExpiresAt: true,
            bookingId: true
        } 
    });

    if (filter.fromSeq && filter.toSeq){
        const fromSeq = parseInt(filter.fromSeq);
        const toSeq = parseInt(filter.toSeq);

        const overlappingStationsLocks = await prisma.seatSegmentLock.findMany({
            where: {
                scheduleId,
                status: {in: ['LOCKED','BOOKED']},
                fromSeq: {lt: toSeq},
                toSeq: {gt: fromSeq}
            },
            select: {
                seatId: true,
                status: true
            }
        });

        const overLapSeatIds = new Set(overlappingStationsLocks.map((x)=>x.seatId));

        const seatWithAnyLock = await prisma.seatInventory.findMany({
            where: {
                scheduleId,
                status: {in:['LOCKED','BOOKED']}
            },
            select: {seatId: true},
            distinct: ['seatId']
        });

        const seatWithLocks = new Set(seatWithAnyLock.map((m)=> m.seatId));
        seats = seats.map((s)=>{
            if(overLapSeatIds.has(s.seatId)){
                return {...s,segmentStatus: 'UNAVAILABLE'};
            }
            if((seat.status === 'BOOKED' || seat.status==='LOCKED') && !seatWithLocks.has(s.seatId)){
                return {...s,segmentStatus: 'UNAVAILABLE'};
            }
            return { ...s, segmentStatus : 'AVAILABLE'};
        });
    }

    return {
        scheduleId,
        totalSeats: data.totalSeats,
        seats
    }
}


const lockSeatsService = async (scheduleId, seatIds, userId,ttlSec,fromSeq,toSeq)=>{
    const ttl = Math.min(Math.max(ttlSec || config.LOCK_TTL_SECONDS,60),600);
    const lockExpiresAt = new Date(Date.now()+ttl *1000);

    const result = await retryTransactrion(async()=>{
        return prisma.$transaction(async(tx)=>{
            const schedule = await tx.scheduleInventory.findUnique({
                where:{
                    scheduleId
                }
            });

            if(!schedule) throw new NotFoundError('Schedule id is not found');
            if(schedule.status !== 'ACTIVE') throw new BadRequestError('schedule is not active');

            const seats = await tx.$queryRaw`
                    SELECT id,"seatId","seatNumber",status,"lockedBy"
                    FROM seat_inventories
                    WHERE "scheduleId" = ${scheduleId}
                    AND "seatId" = ANY(${seatIds}::text[])
                    FOR UPDATE NOWAIT
            `;

            if(seats.length != seatIds.length){
                const foundIds = new Set(seats.map(s=> s.seatId));
                const missing = seatIds.filter(id=> !foundIds.has(id));
                throw new NotFoundError(`Seats are not found during Locking ${missing.join(', ')}`)
            }

            if(fromSeq && toSeq){
                const overlapping = await tx.$queryRaw`
                    SELECT "seatId" FROM seat_segment_locks
                    WHERE "scheduleId" = ${scheduleId}
                    AND "seatId" = ANY(${seatIds}::text[])
                    AND status IN ('LOCKED','BOOKED')
                    AND "fromSeq" < ${toSeq}
                    AND "toSeq"  > ${fromSeq}
                    FOR UPDATE NOWAIT
                `;
                if(overlapping.length>0){
                    const blockIds = [...new Set(overlapping.map(seat=> seat.seatId))];
                    throw new ConflictError(
                        `seats already locked/booked for overlapping segments ${blockIds.join(', ')}`,
                        'SEATS_UNAVAILABLE'
                    )
                }

                for (const seat of seats) {
                    await tx.seatSegmentLock.create({
                        data: {
                            scheduleId,
                            seatId: seat.seatId,
                            fromSeq,
                            toSeq,
                            status: 'LOCKED',
                            lockedBy: userId,
                            lockedAt: new Date(),
                            lockedExpiresAt: lockExpiresAt,
                        },
                    });
                }

            }else{
                const notAvailable = seats.filter(seat=> seat.status !== 'AVAILABLE');
                if(notAvailable.length>0){
                    throw new ConflictError(
                        `Seats are not availbale: ${notAvailable.map(seat=>  `seat #${seat.seatNumber} is ${seat.status}`).join(', ')}`,
                        `SEAT_UNAVAILABLE`
                    );
                }
            }

            if(fromSeq && toSeq){
                const seatPkIds = seats.map(s=> s.id);
                await tx.$executeRaw`
                    UPDATE seat_inventories
                    SET "lockedBy" = COALESCE("lockedBy",${userId}),
                        "lockedAt" = COALESCE("lockedAt",NOW()),
                        "lockExpiresAt" = ${lockExpiresAt}::timestamp,
                        "updatedAt" = NOW()
                    WHERE id = ANY(${seatPkIds}::text[])
                `;

                const affectedSeatIds = seats.map(s=> s.seatId);
                await recomputeSegmentSeatStatus(tx,scheduleId,affectedSeatIds);

                const counts = await recountScheduleAggregates(tx,scheduleId);

                return {
                    scheduleId,
                    trainId: schedule.trainId,
                    lockedSeats: seats.map(s => ({
                        seatId: s.seatId,
                        seatNumber: s.seatNumber,
                        lockExpiresAt,
                    })),
                    lockExpiresAt,
                    counts,
                };

            }


            const seatPkIds = seats.map(s=> s.id);

            await tx.$executeRaw`
                UPDATE seat_inventories
                SET status = 'LOCKED', "lockedBy"= ${userId},
                    "lockedAt" = NOW(), "lockExpiresAt" = ${lockExpiresAt}::timestamp,
                    version=version+1, "updatedAt" = NOW()
                WHERE id = ANY(${seatPkIds}::text[])
            `;

            await tx.$executeRaw`
                    UPDATE schedule_inventories
                    SET available = available - ${seats.length},
                        locked = locked + ${seats.length},
                        version = version + 1,
                        "updatedAt" = NOW()
                    WHERE "scheduleId" = ${scheduleId}
               `;
            return {
                scheduleId,
                trainId: schedule.trainId,
                lockedSeats: seats.map(s => ({
                    seatId: s.seatId,
                    seatNumber: s.seatNumber,
                    lockExpiresAt,
                })),
                lockExpiresAt,
                counts: {
                    available: schedule.available - seats.length,
                    locked: schedule.locked + seats.length,
                    booked: schedule.booked,
                },
            };
        },{timeout: 1000})
    });

    // publish to kafka
}

const confirmSeatsService = async(scheduleId,seatIds,userId,bookingId,fromSeq,toSeq)=>{
    const result = await retryTransactrion(async()=>{
       return prisma.$transaction(async(tx)=>{
        const seats = await tx.$queryRaw`
            SELECT id, "seatId", "seatNumber" status ,"lockedBy"
            FROM seat_inventories
            WHERE "scheduleId" = ${scheduleId}
            AND "seatId" = ANY(${seatIds}::text[])
            FOR UPDATE NOWAIT
        `

        if(seatIds.length !== seats.length){
            throw new NotFoundError(`One or more seats are missing`);
        }

        if(fromSeq && toSeq){
            const update = await tx.$executeRaw`
                UPDATE  seat_segment_locks
                SET status= 'BOOKED', "bookingId" = ${bookingId},
                    "lockExpiresAt" = NULL,
                    version= version+1, "updatedAt"=NOW()
                 WHERE "scheduleId" = ${scheduleId}
                 AND "seatId" = ANY(${seatIds}::text[])
                 AND "lockedBy" = ${userId}
                 AND "fromSeq" = ${fromSeq}
                 AND "toSeq" = ${toSeq}
                 AND status = 'LOCKED'
            `
            if(updated === 0){
                throw new ConflictError(
                    'Segment lock expired or not found. Please lock seats again.',
                    'LOCK_EXPIRED'
                );
            }
        }else{
            const notLockedSeats = seats.filter(s=>s.status !== 'LOCKED');
            if(notLockedSeats.length>0){
                throw new ConflictError(
                    'Lock expired or seats not in LOCKED status. Please lock seats again.',
                    'LOCK_EXPIRED'
                )
            }
            const notLockedByUser = seats.filter(s=> s.lockedBy !== userId);
            if(notLockedByUser.length>0){
                throw new ForbiddenError('Some seats are not locked by you')
            }
        }

        if(fromSeq && toSeq){
            const affectedSeatIds = seats.map(s=> s.seatId);
            await recomputeSegmentSeatStatus(tx,scheduleId,affectedIds);
            const counts = await recountScheduleAggregates(tx,scheduleId);
            const schedule = await tx.scheduleInventory.findUnique({
                where:{
                    scheduleId
                }
            })
            return {
                scheduleId,
                tarinId: schedule.trainId,
                bookingId,
                confirmedSeats: seats.map(s=>({
                    seatId:s.seatId,
                    seatNumber: s.seatNumber,
                    status: 'BOOkED',
                })),
                counts,
            };
        }
        const seatPeakId = seats.map(s=> s.id);
        await tx.$executeRaw`
            UPDATE seat_inventories
            SET status = 'BOOKED',"bookingId"=${bookingId}
                "lockExpiresAt" = NULL
                version = version + 1, "updatedAt" = NOW()
            WHERE id = ANY(${seatPeakId}::text[])
        `;

        const schedule = await tx.scheduleInventory.findUnique({
            where:{
                scheduleId
            }
        });

        await tx.$executeRaw`
            UPDATE schedule_inventories
            SET locked = locked - ${seats.length}
                booked = booked + ${seats.length}
                version = version + 1,
                "updatedAt" = NOW()
            WHERE "scheduleId" = ${scheduleId}
        `;

        return {
            scheduleId,
            trainId: schedule.trainId,
            bookingId,
            confirmedSeats: seats.map(s => ({
                seatId: s.seatId,
                seatNumber: s.seatNumber,
                status: 'BOOKED',
            })),
            counts: {
                available: schedule.available,
                locked: schedule.locked - seats.length,
                booked: schedule.booked + seats.length,
            },
        }

       },{timeout: 1000}) 
    });

    //publish event to kafka
    return result;
}

const cancelBookingService = async(scheduleId,bookingId,userId)=>{
    const result = await retryTransactrion(async()=>{
        return prisma.$transaction(async(tx)=>{
            const segmentLocks = await tx.seatSegmentLock.findMany(
                {
                    where:{scheduId,bookingId,status: 'BOOKED'}
                }
            )
            if(segmentLocks.length>0){
                await tx.$executeRaw`
                    DELETE FROM seat_segment_locks
                    WHERE "scheduleId" = ${scheduleId}
                    AND "bookingId" = ${bookingId}
                `

                const affectedSeatIds = [...new Set(segmentLocks.map(l=> l.seatId))];
                await recomputeSegmentSeatStatus(tx, scheduleId, affectedSeatIds);
                const counts = await recountScheduleAggregates(tx,scheduId);

                const schedule = await tx.scheduleInventory.findUnique({
                    where:{
                        scheduleId
                    }
                })
                return {
                    scheduId,
                    trainId: scheduleId.trainId,
                    bookingId,
                    releasedSeats: affectedSeatIds,
                    counts
                }
            }

            const seats = await tx.$queryRaw`
                    SELECT id, "seatId", "seatNumber", status, "lockedBy"
                    FROM seat_inventories
                    WHERE "scheduleId" = ${scheduleId}
                    AND "bookingId" = ${bookingId}
                    AND status = 'BOOKED'
                    FOR UPDATE NOWAIT
               `;

            if (seats.length === 0) {
                throw new NotFoundError('No booked seats found for this booking');
            }

            const seatPkIds = seats.map(s => s.id);
            await tx.$executeRaw`
                    UPDATE seat_inventories
                    SET status = 'AVAILABLE', "lockedBy" = NULL,
                        "lockedAt" = NULL, "lockExpiresAt" = NULL, "bookingId" = NULL,
                        version = version + 1, "updatedAt" = NOW()
                    WHERE id = ANY(${seatPkIds}::text[])
               `;

            const schedule = await tx.scheduleInventory.findUnique({ where: { scheduleId } });

            await tx.$executeRaw`
                    UPDATE schedule_inventories
                    SET available = available + ${seats.length},
                        booked = booked - ${seats.length},
                        version = version + 1,
                        "updatedAt" = NOW()
                    WHERE "scheduleId" = ${scheduleId}
               `;

            return {
                scheduleId,
                trainId: schedule.trainId,
                bookingId,
                releasedSeats: seats.map(s => s.seatId),
                counts: {
                    available: schedule.available + seats.length,
                    locked: schedule.locked,
                    booked: schedule.booked - seats.length,
                },
            };
        },{timeout: 1000})
    })
    //publish event
    return result;
}

const unlockSeatsService = async(scheduleId,seatIds,userId,fromSeq,toSeq)=>{
    const result = await retryTransactrion(async()=>{
        return prisma.$transaction(async(tx)=>{

            const seats = await tx.$queryRaw`
                    SELECT id,"seatId","seatNumber",
                    FROM seat_inventories
                    WHERE "scheduleId"=${scheduleId}
                    AND "seatId" = ANY($(seatIds)::text[])
                    FOR UPDATE NOWAIT
            `;

            if(seats.length!==seatIds.length){
                throw new NotFoundError('One or more seats not found');
            }
            if (fromSeq && toSeq) {
                await tx.$executeRaw`
                         DELETE FROM seat_segment_locks
                         WHERE "scheduleId" = ${scheduleId}
                         AND "seatId" = ANY(${seatIds}::text[])
                         AND "lockedBy" = ${userId}
                         AND "fromSeq" = ${fromSeq}
                         AND "toSeq" = ${toSeq}
                         AND status = 'LOCKED'
                    `;

                const affectedSeatIds = seats.map(s => s.seatId);
                await recomputeSegmentSeatStatuses(tx, scheduleId, affectedSeatIds);
                const counts = await recountScheduleAggregates(tx, scheduleId);

                const schedule = await tx.scheduleInventory.findUnique({ where: { scheduleId } });

                return {
                    scheduleId,
                    trainId: schedule.trainId,
                    unlockedSeats: seats.map(s => s.seatId),
                    counts,
                };
            }

            const notLocked = seats.filter(s => s.status !== 'LOCKED');
            if (notLocked.length > 0) {
                throw new ConflictError(
                    `Seats not in LOCKED status: ${notLocked.map(s => `seat #${s.seatNumber} is ${s.status}`).join(', ')}`
                );
            }

            const notOwnedByUser = seats.filter(s => s.lockedBy !== userId);
            if (notOwnedByUser.length > 0) {
                throw new ForbiddenError('Some seats are not locked by you');
            }

            const seatPkIds = seats.map(s => s.id);
            await tx.$executeRaw`
                    UPDATE seat_inventories
                    SET status = 'AVAILABLE', "lockedBy" = NULL,
                        "lockedAt" = NULL, "lockExpiresAt" = NULL,
                        version = version + 1, "updatedAt" = NOW()
                    WHERE id = ANY(${seatPkIds}::text[])
               `;

            const schedule = await tx.scheduleInventory.findUnique({ where: { scheduleId } });

            await tx.$executeRaw`
                    UPDATE schedule_inventories
                    SET available = available + ${seats.length},
                        locked = locked - ${seats.length},
                        version = version + 1,
                        "updatedAt" = NOW()
                    WHERE "scheduleId" = ${scheduleId}
               `;

            return {
                scheduleId,
                trainId: schedule.trainId,
                unlockedSeats: seats.map(s => s.seatId),
                counts: {
                    available: schedule.available + seats.length,
                    locked: schedule.locked - seats.length,
                    booked: schedule.booked,
                },
            };

        },{timeout: 1000})
    })

    //Evenet publish
    return result;
}

const recountAndPublishService = async(scheduleId)=>{
    const counts = await prisma.$queryRaw`
        SELECT
            COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int AS available,
            COUNT(*) FILTER (WHERE status = 'LOCKED')::int AS locked,
            COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked
        FROM seat_inventories
        WHERE "scheduleId" = ${scheduleId}
    `;

    const {available,locked,booked} = counts[0];

    const schedule = await prisma.scheduleInventory.update({
        where:{scheduleId},
        data: {
             available, locked, booked, version: { increment: 1 }
        
        }
    })
    try {
        await inventoryProducer.publishSeatAvailabilityUpdated(
            scheduleId,
            schedule.trainId,
            available,
            locked,
            booked
        );
    } catch (publishErr) {
        logger.warn('Failed to publish seat availability update', {
            scheduleId,
            error: publishErr.message,
        });
    }

    return { available, locked, booked };
};

const recomputeSegmentSeatStatuses = recomputeSegmentSeatStatus;
const recountAndPublish = recountAndPublishService;

export {
    recomputeSegmentSeatStatus,
    recomputeSegmentSeatStatuses,
    recountScheduleAggregates,
    initializeInventory,
    cancelScheduleInventory,
    getSceduleService,
    getScheduleSeatsService,
    lockSeatsService,
    confirmSeatsService,
    cancelBookingService,
    unlockSeatsService,
    recountAndPublishService,
    recountAndPublish,
};

const inventoryService = {
    recomputeSegmentSeatStatus,
    recomputeSegmentSeatStatuses,
    recountScheduleAggregates,
    initializeInventory,
    cancelScheduleInventory,
    getSceduleService,
    getScheduleSeatsService,
    lockSeatsService,
    confirmSeatsService,
    cancelBookingService,
    unlockSeatsService,
    recountAndPublishService,
    recountAndPublish,
};

export default inventoryService;