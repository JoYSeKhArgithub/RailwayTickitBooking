import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { inventoryClient } from "./inventoryClient.service.js";
import { paymentClient } from "./paymentClient.service.js";

const sagaHoldSeats = async (bookingRecord, seatIdList, ttlSec, fromSeq, toSeq) => {
    const sagaLogRecord = await prisma.sagaLog.create({
        data: {
            bookingId: bookingRecord.id,
            step: 'HOLD_SEATS',
            status: 'PENDING',
            request: {
                scheduleId: bookingRecord.scheduleId,
                seatIds: seatIdList,
                userId: bookingRecord.userId,
                ttlSec,
                fromSeq,
                toSeq,
            },
        },
    });

    try {
        const holdResult = await inventoryClient.holdSeats(
            bookingRecord.scheduleId,
            seatIdList,
            bookingRecord.userId,
            ttlSec,
            fromSeq,
            toSeq
        );

        await prisma.sagaLog.update({
            where: {
                id: sagaLogRecord.id,
            },
            data: {
                status: 'COMPLETED',
                response: holdResult,
            },
        });

        await prisma.booking.update({
            where: { id: bookingRecord.id },
            data: {
                status: 'SEATS_HELD',
            },
        });
        logger.info(`Saga HOLD_SEATS completed for booking ${bookingRecord.id}`);
        return holdResult;
    } catch (holdError) {
        const errorMsg = holdError.response?.data?.message || holdError.message;
        await prisma.sagaLog.update({
            where: {
                id: sagaLogRecord.id,
            },
            data: {
                status: 'FAILED',
                error: errorMsg,
            },
        });
        throw holdError;
    }
};

const sagaCreatePaymentOrder = async (bookingRecord) => {
    const idempotencyKey = `${bookingRecord.id}-paymentorder`;
    const sagaLogRecord = await prisma.sagaLog.create({
        data: {
            bookingId: bookingRecord.id,
            step: 'CREATE_PAYMENT',
            status: 'PENDING',
            request: {
                bookingId: bookingRecord.id,
                amount: bookingRecord.totalAmount,
                userId: bookingRecord.userId,
            },
        },
    });
    try {
        const orderResult = await paymentClient.createPaymentOrder(
            bookingRecord.id,
            bookingRecord.totalAmount,
            bookingRecord.userId,
            idempotencyKey
        );

        await prisma.sagaLog.update({
            where: {
                id: sagaLogRecord.id,
            },
            data: {
                status: 'COMPLETED',
                response: orderResult,
            },
        });

        await prisma.booking.update({
            where: { id: bookingRecord.id },
            data: {
                status: 'PAYMENT_PENDING',
                paymentOrderId: orderResult.paymentOrderId,
            },
        });
        logger.info(`Saga CREATE_PAYMENT completed for booking ${bookingRecord.id}`);
        return orderResult;
    } catch (orderError) {
        const errorMsg = orderError.response?.data?.message || orderError.message;
        await prisma.sagaLog.update({
            where: { id: sagaLogRecord.id },
            data: { status: 'FAILED', error: errorMsg },
        });
        throw orderError;
    }
};

const rollbackCreatePayment = async (bookingRecord) => {
    if (!bookingRecord.paymentOrderId) return;

    logger.info(`Compensating CREATE_PAYMENT for booking ${bookingRecord.id}`);
    try {
        const idempotencyKey = `${bookingRecord.id}-refund-compensation`;
        await paymentClient.initiateRefund(
            bookingRecord.paymentOrderId,
            bookingRecord.totalAmount,
            'booking_compensation',
            idempotencyKey
        );

        await prisma.sagaLog.updateMany({
            where: { bookingId: bookingRecord.id, step: 'CREATE_PAYMENT', status: 'COMPLETED' },
            data: { status: 'COMPENSATED' },
        });
    } catch (refundCompensationError) {
        logger.error(`Failed to compensate CREATE_PAYMENT for booking ${bookingRecord.id}`, {
            error: refundCompensationError.message,
        });
    }
};

const rollbackHoldSeats = async (bookingRecord, seatIdList) => {
    logger.info(`Compensating HOLD_SEATS for booking ${bookingRecord.id}`);
    try {
        await inventoryClient.releaseSeats(
            bookingRecord.scheduleId,
            seatIdList,
            bookingRecord.userId,
            bookingRecord.fromSeq,
            bookingRecord.toSeq
        );
        await prisma.sagaLog.updateMany({
            where: { bookingId: bookingRecord.id, step: 'HOLD_SEATS', status: 'COMPLETED' },
            data: { status: 'COMPENSATED' },
        });
    } catch (releaseCompensationError) {
        logger.error(`Failed to compensate HOLD_SEATS for booking ${bookingRecord.id}`, {
            error: releaseCompensationError.message,
        });
    }
};

const rollbackConfirmSeats = async (bookingRecord)=>{
    try{
        await inventoryClient.cancelBooking(bookingRecord.scheduleId,bookingRecord.id,bookingRecord.userId);
        await prisma.sagaLog.updateMany({
            where: {
                bookingId: bookingRecord.id,
                step: 'CONFIRM_SEATS', status: 'COMPLETED'
            },
            data: {
                status: 'COMPENSATED'
            }
        })
    }catch(error){
        logger.error(`Failed to compensate CONFIRM_SEATS for booking ${booking.id}`, {
               error: error.message,
          });
    }
}

const rollbackAll = async (bookingRecord, seatIdList) => {
    const completeSteps = await prisma.sagaLog.findMany({
        where: {
            bookingId: bookingRecord.id,
            status: 'COMPLETED',
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    for (const stepItem of completeSteps) {
        switch (stepItem.step) {
            case 'CREATE_PAYMENT':
                await rollbackCreatePayment(bookingRecord);
                break;
            case 'HOLD_SEATS':
                await rollbackHoldSeats(bookingRecord, seatIdList);
                break;
            case 'CONFIRM_SEATS':
                await rollbackConfirmSeats(bookingRecord);
                break;
        }
    }
};

const executeConfirmSeats = async (bookingRecord, seatIdList, fromSeq, toSeq) => {
    const sagaLogRecord = await prisma.sagaLog.create({
        data: {
            bookingId: bookingRecord.id,
            step: 'CONFIRM_SEATS',
            status: 'PENDING',
            request: {
                scheduleId: bookingRecord.scheduleId,
                seatIds: seatIdList,
                userId: bookingRecord.userId,
                fromSeq,
                toSeq,
            },
        },
    });

    try {
        const confirmResult = await inventoryClient.confirmSeats(
            bookingRecord.scheduleId,
            seatIdList,
            bookingRecord.userId,
            fromSeq,
            toSeq
        );

        await prisma.sagaLog.update({
            where: { id: sagaLogRecord.id },
            data: {
                status: 'COMPLETED',
                response: confirmResult,
            },
        });

        logger.info(`Saga CONFIRM_SEATS completed for booking ${bookingRecord.id}`);
        return confirmResult;
    } catch (confirmError) {
        const errorMsg = confirmError.response?.data?.message || confirmError.message;
        await prisma.sagaLog.update({
            where: { id: sagaLogRecord.id },
            data: { status: 'FAILED', error: errorMsg },
        });
        throw confirmError;
    }
};

const executeHoldSeats = sagaHoldSeats;
const executeCreatePayment = sagaCreatePaymentOrder;
const compensateHoldSeats = rollbackHoldSeats;
const compensateCreatePayment = rollbackCreatePayment;
const compensateAll = rollbackAll;

const sagaService = {
    sagaHoldSeats,
    sagaCreatePaymentOrder,
    executeHoldSeats,
    executeCreatePayment,
    executeConfirmSeats,
    rollbackHoldSeats,
    rollbackCreatePayment,
    rollbackAll,
    compensateHoldSeats,
    compensateCreatePayment,
    compensateAll,
    rollbackConfirmSeats
};

export {
    sagaHoldSeats,
    sagaCreatePaymentOrder,
    executeHoldSeats,
    executeCreatePayment,
    executeConfirmSeats,
    rollbackHoldSeats,
    rollbackCreatePayment,
    rollbackAll,
    compensateHoldSeats,
    compensateCreatePayment,
    compensateAll,
    rollbackConfirmSeats
};

export default sagaService;
