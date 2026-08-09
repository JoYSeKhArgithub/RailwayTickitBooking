import { prisma } from "../config/prisma.js"
import { invenToryClient } from "./inventoryClient.service"
import { paymentClient } from "./paymentClient.service.js";

const sagaHoldSeats = async(booking,seatIds,ttlSec,fromSeq,toSeq)=>{
    const sagaLog = await prisma.sagaLog.create({
        data:{
            bookingId: booking.id,
            step: 'HOLD_SEATS',
            status: 'PENDING',
            request: {
                scheduleId: booking.scheduleId,
                seatIds,
                userId: booking.userId,
                ttlSec,
                fromSeq,
                toSeq
            }
        }
    })

    try {
        const result = await invenToryClient.holdSeats(
            booking.scheduleId,
            seatIds,booking.userId,
            ttlSec,
            fromSeq,
            toSeq
        );

        await prisma.sagaLog.update({
            where: {
                id: booking.id
            },
            data: {
                status: 'COMPLETED',
                response: result
            }
        })

        await prisma.booking.update({
            where: {id: booking.id},
            data: {
                status:'SEAT_HELD'
            }
        });
        logger.info(`Saga HOLD_SEATS completed for booking ${booking.id}`);
        return result;
    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        await prisma.sagaLog.update({
            where: {
                id: booking.id
            },
            data: {
                status: 'FAILED',
                error: errorMsg
            }
        });
        throw error;
    }
},

const sagaCreatePaymentOrder = async(booking)=>{
    const idempotencyKey = `${booking.id}-paymentorder`;
    const sagaLog = await prisma.sagaLog.create({
        data:{
            bookingId: booking.id,
            step: 'CREATE_PAYMENT',
            status: 'PENDING',
            request: {
                bookingId: booking.id,
                amount: booking.totalAmount,
                userId: booking.userId
            }
        }
    })
    try {
        const result = await paymentClient.createPaymentOrder(
            booking.id,
            booking.totalAmount,
            booking.userId,
            idempotencyKey
        )

        await prisma.sagaLog.update({
            where: {
                id: sagaLog.id
            },
            data: {
                status: 'COMPLETED',
                response: result
            }
        })

        await prisma.booking.update({
            where: {id: booking.id},
            data:{
                status: 'PAYMENT_PENDING',
                paymentOrderId: result.paymentOrderId,
            }
        });
        logger.info(`Saga CREATE_PAYMENT completed for booking ${booking.id}`);
        return result;
    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        await prisma.sagaLog.update({
            where: { id: sagaLog.id },
            data: { status: 'FAILED', error: errorMsg },
        });
        throw error;
    }
}


const rollbackCreatePayment = async (booking) => {
    if (!booking.paymentOrderId) return;

    logger.info(`Compensating CREATE_PAYMENT for booking ${booking.id}`);
    try {
        const idempotencyKey = `${booking.id}-refund-compensation`;
        await paymentClient.initiateRefund(
            booking.paymentOrderId,
            booking.totalAmount,
            'booking_compensation',
            idempotencyKey
        );

        await prisma.sagaLog.updateMany({
            where: { bookingId: booking.id, step: 'CREATE_PAYMENT', status: 'COMPLETED' },
            data: { status: 'COMPENSATED' },
        });
    } catch (error) {
        logger.error(`Failed to compensate CREATE_PAYMENT for booking ${booking.id}`, {
            error: error.message,
        });
    }
}

const rollbackHoldSeats = async () => {
    logger.info(`Compensating HOLD_SEATS for booking ${booking.id}`);
    try {
        await inventoryClient.releaseSeats(booking.scheduleId, seatIds, booking.userId, booking.fromSeq, booking.toSeq);
        await prisma.sagaLog.updateMany({
            where: { bookingId: booking.id, step: 'HOLD_SEATS', status: 'COMPLETED' },
            data: { status: 'COMPENSATED' },
        });
    } catch (error) {
        logger.error(`Failed to compensate HOLD_SEATS for booking ${booking.id}`, {
            error: error.message,
        });
    }
}



const rollbackAll = async(bookig,seatIds)=>{
    const completeSteps = await prisma.sagaLog.findMany({
        where: {
            bookingId: booking.id,
            status: 'COMPLETED'
        },
        orderBy:{
            createdAt: 'desc'
        }
    });

    for( step of completeSteps){
        switch(step.step){
            case 'CREATE_PAYMENT':
                await rollbackCreatePayment(booking);
                break;
            case 'HOLD_SEATS':
                await rollbackHoldSeats(booking,seatIds);
                break;
        }
    }

}



export default {
    sagaHoldSeats,
    sagaCreatePaymentOrder,
    rollbackAll
}