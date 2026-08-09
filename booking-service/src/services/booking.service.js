import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js";
import { config } from "../config/root.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/error.js"
import distributedLockService from "./distributedLock.service.js";
import { invenToryClient } from "./inventoryClient.service.js";
import sagaService from "./saga.service.js";

const checkIdempotency = async(key)=>{
    const existing = await prisma.idempotencyRecord.findUnique({
        where:{
            eventKey: key
        }
    });
    if(existing){
        logger.info(`Idempotency request :${key}`);
        return existing.response
    }
    return null;
}

const saveIdempotency = async(key,response)=>{
    await prisma.idempotencyRecord.create({
        data: {
            eventKey: key, response
        }
    })
}

const createBookingService = async (userId, scheduleId, seatIds, passengers, idempotencyKey, fromStationId, toStationId, fromSeq, toSeq)=>{
    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0){
        throw new BadRequestError('schduleId should present and seatIds are required');
    }

    if(!passengers || !Array.isArray(passengers) || passengers.length === 0){
        throw new BadRequestError('passengers should be present and it should be non empty array')
    }

    if(seatIds.length !== passengers.length){
        throw new BadRequestError('The passengers and booked seats are mismathced');
    }

    if(!idempotencyKey){
        throw new BadRequestError('idempotencyKey is required');
    }

    if(fromSeq && toSeq && fromSeq >= toSeq){
        throw new BadRequestError('fromStation must come before toStation in route');
    }

    const idempotentCachedKey = await checkIdempotency(`booking:${idempotencyKey}`)
    if (idempotentCachedKey) return idempotentCachedKey;

    const availableSeats = await invenToryClient.getAvailableSeats(scheduleId);
    if (availableSeats.status !== 'ACTIVE'){
        throw new BadRequestError('Schedule is not active')
    }

    if (new Date(availableSeats.departureDate)<new Date()){
        throw new BadRequestError('Cannot book previous departured train')
    }

    const seatData = await invenToryClient.getSeats(scheduleId,{
        fromSeq: fromSeq || undefined,
        toSeq: toSeq || undefined
    })

    const seatMap = new Map(seatData.seats.map((seat)=> [seat.id,seat]));
    const bookingSeats = [];
    let totalAmount = 0;
    for(const seatId of seatIds){
        const seat = seatMap.get(seatId);
        if(!seat){
            throw new NotFoundError(`Seat are not found for booking`);
        }
        const isAvailable = (fromSeq && toSeq && seat.segmentStatus !== undefined)
            ? seat.segmentStatus === 'AVAILABLE'
            : seat.status === 'AVAILABLE';
        
        if (!isAvailable) throw new ConflictError(`Seat #${seat.seatNumber} is not available for this segment`, 'SEATS_UNAVAILABLE');
        bookingSeats.push(seat);
        totalAmount += seat.price;
    }
    const sortedSeatIds = [...seatIds].sort();
    const { acquired, lockValue } = await distributedLockService.acquireSeatLocks(
        scheduleId,sortedSeatIds,`acclock-temp-${Date.now()}`,
        config.BOOKING_TTL_SECONDS,
        fromSeq,
        toSeq
    )

    if(!acquired){
        throw new ConflictError('seats are booked by another user please try again later','SEATS_LOCKED')
    }
    let booking;
    try {
        const lockExpiresAt = new Date(Date.now()+ config.BOOKING_TTL_SECONDS *1000);
        booking = await prisma.booking.create({
            data: {
                userId,
                scheduleId,
                trainId: availableSeats.trainId,
                trainNumber: availableSeats.trainNumber,
                trainName: availableSeats.trainName,
                departureDate: new Date(availableSeats.departureDate),
                status: 'PENDING',
                totalAmount,
                seatCount: seatIds.length,
                fromStationId,
                toStationId,
                fromSeq,
                toSeq,
                idempotencyKey,
                lockExpiresAt,
                seats: {
                    create: bookingSeats.map((seat)=>({
                        seatId: seat.seatId,
                        seatNumber: seat.seatNumber,
                        seatType: seat.seatType,
                        price: seat.price
                    }))
                },
                passengers:{
                    create: passengers.map((item,index)=> ({
                        name: item.name,
                        age: item.age,
                        gender: item.gender,
                        seatId: seatIds[index]
                    }))
                }
            },
            include:{
                seats: true,
                passengers: true
            }
        });

        await sagaService.sagaHoldSeats(booking,sortedSeatIds, config.LOCK_TTL_SECONDS,fromSeq,toSeq)
        const paymentOrder = await sagaService.sagaCreatePaymentOrder(booking);
        
        booking = await prisma.booking.findUnique({
            where: { id: booking.id},
            include: {
                seats: true,
                passengers: true
            }
        })

        const response = {
            bookingId: booking.id,
            status: booking.status,
            totalAmount: booking.totalAmount,
            lockExpiresAt: booking.lockExpiresAt,
            seats: booking.seats.map((seat)=>({
                seatId: seat.seatId,
                seatNumber: seat.seatNumber,
                seatType: seat.seatType,
                price: seat.price
            })),
            passengers: booking.passengers.map((item)=>({
                name: item.name,
                age: item.age,
                gender: item.gender
            })),
            paymentOrder: {
                paymentOrderId: paymentOrder.paymentOrderId,
                gatewayOrderId: paymentOrder.gatewayOrderId,
                amount: paymentOrder.amount,
                currency: paymentOrder.currency,
                keyId: paymentOrder.keyId,
            },
        };

        await saveIdempotency(`booking:${idempotencyKey}`,response);
        return response;
    } catch (error) {
        logger.error(`Booking creation failed for user ${userId}`, { error: error.message });
        if(booking){
            await saga.rollbackAll(booking, sortedSeatIds);
            await prisma.booking.update({
                where: {id: booking.id},
                data: {
                    status: 'FAILED',
                    failureReason: error.response?.data?.message || error.message,
                },
            });
        }
        await distributedLockService.releasedSeatLocks(scheduleId,sortedSeatIds,lockValue,fromSeq,toSeq)
        throw error;
    }
}


export default {createBookingService}