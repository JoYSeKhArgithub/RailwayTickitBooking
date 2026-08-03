import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";
import { inventroyProducer } from "../kafka/inventoryProducer.js";
import { BadRequest, NotFoundError } from "../utils/error.js";

const initializeInventory = async(eventData)=>{
    const {scheduleId, trainId,trainNumber,trainName,departureDate,seats} = eventData;
    if(!scheduleId || !seats || !seats.length){
        logger.warn('Invalide scheduleId or in the schedule seats are missing');
        return;
    }
    const eventKey = `SCEDULE_CREATED-${scheduleId}`;
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
                blocked: 0,
                status: 'ACTIVE'
            }
        })

        const seatData =seats.map((seat)=>({
            scheduleInventoryId: schedule.id,
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

        if(eventData.route && eventData.route.length>0){
            const routeStop = eventData.route.map(rs=>({
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
        logger.error('Failed to publish initial availability event after retries', { scheduleId, error: error.message });
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
                scheuleId
            },
            data:{
                status: 'CANCELLED',
            }
        });
        await tx.idempotencyRecord.craete({data: {eventKey}})
    });
    logger.info('Inventory cancelled successfully');
    try {
        await inventoryProducer.publishSeatAvailabilityUpdated(scheduleId, schedule.trainId, 0, 0, 0);
    } catch (error) {
        logger.error('Failed to publish seat availability after retries')
    }
}

const getSceduleService= async(scheduleId)=>{
    if (!scheduleId) throw new BadRequest('Scedule Id is mandatory to get scedule');
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

export default {
    initializeInventory,
    cancelScheduleInventory,
    getSceduleService
}