import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { config } from '../config/root.js';
import { inventoryClient } from './inventoryClient.service.js';
import { paymentClient } from './paymentClient.service.js';
import { userClient } from './userClient.service.js';
import { stationClient } from './stationClient.service.js';
import { acquireSeatLocks, releaseSeatLocks, forceReleaseSeatLocks } from '../utils/distributedLock.js';
import saga from './saga.service.js';
import { bookingProducer } from '../kafka/producer/booking.producer.js';
import { BadRequestError, NotFoundError, ConflictError, StaleStateError } from '../utils/error.js';

const casUpdateBooking = async (targetBookingId, expectedVersion, updateData) => {
    const updateResult = await prisma.booking.updateMany({
        where: { id: targetBookingId, version: expectedVersion },
        data: { ...updateData, version: { increment: 1 } },
    });

    if (updateResult.count === 0) {
        throw new StaleStateError(
            `Booking ${targetBookingId} was modified by another process (expected version ${expectedVersion})`
        );
    }
    return updateResult;
};

const retryOnConflict = async (operationFn, maxRetries = 3, baseDelayMs = 50) => {
    let attemptIndex = 0;
    while (attemptIndex < maxRetries) {
        try {
            return await operationFn();
        } catch (opError) {
            attemptIndex++;
            const isConflict = opError.statusCode === 409 ||
                opError.code === 'STALE_STATE' ||
                (opError.message && opError.message.includes('modified by another process'));

            if (isConflict) {
                if (attemptIndex >= maxRetries) {
                    logger.error('Max retries reached. Database transaction aborted due to conflict.');
                    throw opError;
                }
                const randomJitter = Math.random() * 50;
                const retryDelay = Math.pow(2, attemptIndex) * baseDelayMs + randomJitter;

                logger.warn(`Database collision detected. Retrying attempt ${attemptIndex}/${maxRetries} after ${Math.round(retryDelay)}ms...`);
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            } else {
                throw opError;
            }
        }
    }
};

const fetchUserForNotification = async (targetUserId) => {
    try {
        const userDetails = await userClient.getUserById(targetUserId);
        return userDetails ? { email: userDetails.email, firstName: userDetails.firstName } : {};
    } catch (userErr) {
        logger.warn('Failed to enrich booking event with user details', {
            userId: targetUserId,
            error: userErr.message,
        });
        return {};
    }
};

const fetchStationName = async (targetStationId) => {
    if (!targetStationId) return null;
    try {
        const stationObj = await stationClient.getStationById(targetStationId);
        return stationObj ? stationObj.name : null;
    } catch (stationErr) {
        logger.warn('Failed to enrich booking event with station name', {
            stationId: targetStationId,
            error: stationErr.message,
        });
        return null;
    }
};

const checkIdempotency = async (idempotencyKey) => {
    const existingRecord = await prisma.idempotencyRecord.findUnique({ where: { eventKey: idempotencyKey } });
    if (existingRecord) {
        logger.info(`Idempotent request: ${idempotencyKey}`);
        return existingRecord.response;
    }
    return null;
};

const saveIdempotency = async (idempotencyKey, responsePayload) => {
    await prisma.idempotencyRecord.create({
        data: { eventKey: idempotencyKey, response: responsePayload },
    });
};

const createBooking = async (userId, scheduleId, seatIds, passengers, idempotencyKey, fromStationId, toStationId, fromSeq, toSeq) => {
    if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
        throw new BadRequestError('scheduleId and seatIds (non-empty array) are required');
    }
    if (!passengers || !Array.isArray(passengers) || passengers.length === 0) {
        throw new BadRequestError('passengers (non-empty array) is required');
    }
    if (seatIds.length !== passengers.length) {
        throw new BadRequestError('Number of seats must match number of passengers');
    }
    if (!idempotencyKey) {
        throw new BadRequestError('idempotencyKey is required');
    }

    if (fromSeq && toSeq && fromSeq >= toSeq) {
        throw new BadRequestError('fromStation must come before toStation in route');
    }

    const cachedResponse = await checkIdempotency(`booking:${idempotencyKey}`);
    if (cachedResponse) return cachedResponse;

    const scheduleAvailability = await inventoryClient.getAvailability(scheduleId);
    if (scheduleAvailability.status !== 'ACTIVE') {
        throw new BadRequestError('Schedule is not active');
    }

    if (new Date(scheduleAvailability.departureDate) < new Date()) {
        throw new BadRequestError('Cannot book a train that has already departed');
    }

    const scheduleSeatsData = await inventoryClient.getSeats(scheduleId, {
        fromSeq: fromSeq || undefined,
        toSeq: toSeq || undefined,
    });
    const seatMap = new Map((scheduleSeatsData.seats || []).map((s) => [s.seatId || s.id, s]));

    const bookingSeats = [];
    let calculatedTotalAmount = 0;
    for (const seatId of seatIds) {
        const seatObj = seatMap.get(seatId);
        if (!seatObj) {
            throw new NotFoundError(`Seat ${seatId} not found in schedule`);
        }
        const isAvailable = (fromSeq && toSeq && seatObj.segmentStatus !== undefined)
            ? seatObj.segmentStatus === 'AVAILABLE'
            : seatObj.status === 'AVAILABLE';
        if (!isAvailable) {
            throw new ConflictError(`Seat #${seatObj.seatNumber} is not available for this segment`, 'SEATS_UNAVAILABLE');
        }
        bookingSeats.push(seatObj);
        calculatedTotalAmount += seatObj.price;
    }

    const sortedSeatIds = [...seatIds].sort();

    const { acquired, lockValue } = await acquireSeatLocks(
        scheduleId,
        sortedSeatIds,
        `pre-${Date.now()}`,
        config.BOOKING_TTL_SECONDS,
        fromSeq,
        toSeq
    );

    if (!acquired) {
        throw new ConflictError(
            'One or more seats are being booked by another user. Please try again.',
            'SEATS_LOCKED'
        );
    }

    let createdBookingRecord;
    try {
        const lockExpiresAt = new Date(Date.now() + config.BOOKING_TTL_SECONDS * 1000);

        createdBookingRecord = await prisma.booking.create({
            data: {
                userId,
                scheduleId,
                trainId: scheduleAvailability.trainId,
                trainNumber: scheduleAvailability.trainNumber,
                trainName: scheduleAvailability.trainName,
                departureDate: new Date(scheduleAvailability.departureDate),
                status: 'PENDING',
                totalAmount: calculatedTotalAmount,
                seatCount: seatIds.length,
                fromStationId: fromStationId || null,
                toStationId: toStationId || null,
                fromSeq: fromSeq || null,
                toSeq: toSeq || null,
                idempotencyKey,
                lockExpiresAt,
                seats: {
                    create: bookingSeats.map((seatItem) => ({
                        seatId: seatItem.seatId || seatItem.id,
                        seatNumber: seatItem.seatNumber,
                        seatType: seatItem.seatType,
                        price: seatItem.price,
                    })),
                },
                passengers: {
                    create: passengers.map((passengerItem, pIdx) => ({
                        name: passengerItem.name,
                        age: passengerItem.age,
                        gender: passengerItem.gender,
                        seatId: seatIds[pIdx] || null,
                    })),
                },
            },
            include: { seats: true, passengers: true },
        });

        await saga.executeHoldSeats(createdBookingRecord, sortedSeatIds, config.LOCK_TTL_SECONDS, fromSeq, toSeq);

        const paymentOrderDetails = await saga.executeCreatePayment(createdBookingRecord);

        const refreshedBooking = await prisma.booking.findUnique({
            where: { id: createdBookingRecord.id },
            include: { seats: true, passengers: true },
        });

        const finalResponse = {
            bookingId: refreshedBooking.id,
            status: refreshedBooking.status,
            totalAmount: refreshedBooking.totalAmount,
            lockExpiresAt: refreshedBooking.lockExpiresAt,
            seats: refreshedBooking.seats.map((s) => ({
                seatId: s.seatId,
                seatNumber: s.seatNumber,
                seatType: s.seatType,
                price: s.price,
            })),
            passengers: refreshedBooking.passengers.map((p) => ({
                name: p.name,
                age: p.age,
                gender: p.gender,
            })),
            paymentOrder: {
                paymentOrderId: paymentOrderDetails.paymentOrderId,
                gatewayOrderId: paymentOrderDetails.gatewayOrderId,
                amount: paymentOrderDetails.amount,
                currency: paymentOrderDetails.currency,
                keyId: paymentOrderDetails.keyId,
            },
        };

        await saveIdempotency(`booking:${idempotencyKey}`, finalResponse);

        return finalResponse;

    } catch (bookingCreationError) {
        logger.error(`Booking creation failed for user ${userId}`, { error: bookingCreationError.message });

        if (createdBookingRecord) {
            await saga.compensateAll(createdBookingRecord, sortedSeatIds);
            await prisma.booking.update({
                where: { id: createdBookingRecord.id },
                data: {
                    status: 'FAILED',
                    failureReason: bookingCreationError.response?.data?.message || bookingCreationError.message,
                },
            });
        }

        await releaseSeatLocks(scheduleId, sortedSeatIds, lockValue, fromSeq, toSeq);

        throw bookingCreationError;
    }
};

const handlePaymentSuccess = async (paymentOrderId, gatewayPaymentId, amount) => {
    const bookingRecord = await prisma.booking.findUnique({
        where: { paymentOrderId },
        include: { seats: true, passengers: true },
    });

    if (!bookingRecord) {
        logger.warn(`No booking found for paymentOrderId: ${paymentOrderId}`);
        return;
    }

    if (bookingRecord.status === 'CONFIRMED') {
        logger.info(`Booking ${bookingRecord.id} already confirmed`);
        return;
    }

    if (bookingRecord.status !== 'PAYMENT_PENDING') {
        logger.warn(`Booking ${bookingRecord.id} in unexpected status: ${bookingRecord.status}`);
        return;
    }

    const seatIds = bookingRecord.seats.map((s) => s.seatId).sort();

    try {
        await retryOnConflict(async () => {
            const freshBooking = await prisma.booking.findUnique({
                where: { id: bookingRecord.id },
            });
            if (!freshBooking || freshBooking.status === 'CONFIRMED' || freshBooking.status === 'CONFIRMING') return;
            if (freshBooking.status !== 'PAYMENT_PENDING') {
                throw new Error(`Booking ${bookingRecord.id} status changed to ${freshBooking.status}, aborting`);
            }
            await casUpdateBooking(freshBooking.id, freshBooking.version, { status: 'CONFIRMING' });
        });

        await saga.executeConfirmSeats(bookingRecord, seatIds, bookingRecord.fromSeq, bookingRecord.toSeq);

        await prisma.booking.updateMany({
            where: { id: bookingRecord.id, status: 'CONFIRMING' },
            data: { status: 'CONFIRMED', version: { increment: 1 } },
        });

        await forceReleaseSeatLocks(bookingRecord.scheduleId, seatIds, bookingRecord.fromSeq, bookingRecord.toSeq);

        try {
            const [userInfo, fromStationName, toStationName] = await Promise.all([
                fetchUserForNotification(bookingRecord.userId),
                fetchStationName(bookingRecord.fromStationId),
                fetchStationName(bookingRecord.toStationId),
            ]);

            await bookingProducer.publishBookingConfirmed({
                bookingId: bookingRecord.id,
                userId: bookingRecord.userId,
                email: userInfo.email,
                firstName: userInfo.firstName,
                scheduleId: bookingRecord.scheduleId,
                trainNumber: bookingRecord.trainNumber,
                trainName: bookingRecord.trainName,
                fromStationName,
                toStationName,
                departureDate: bookingRecord.departureDate,
                seats: bookingRecord.seats.map((s) => ({
                    seatNumber: s.seatNumber,
                    seatType: s.seatType,
                    price: s.price,
                })),
                passengers: bookingRecord.passengers.map((p) => ({
                    name: p.name,
                    age: p.age,
                    gender: p.gender,
                })),
                totalAmount: bookingRecord.totalAmount,
            });
        } catch (publishErr) {
            logger.error('CRITICAL: Failed to publish BOOKING_CONFIRMED after retries — notification/search may be stale', {
                bookingId: bookingRecord.id,
                error: publishErr.message,
            });
        }

        logger.info(`Booking ${bookingRecord.id} confirmed successfully`);

    } catch (paymentSuccessError) {
        if (paymentSuccessError.code === 'STALE_STATE') {
            logger.info(`Booking ${bookingRecord.id} already handled by another process, skipping`);
            return;
        }

        logger.error(`Failed to confirm booking ${bookingRecord.id}`, { error: paymentSuccessError.message });

        await saga.compensateAll(bookingRecord, seatIds);

        await prisma.booking.updateMany({
            where: { id: bookingRecord.id, status: { in: ['PAYMENT_PENDING', 'CONFIRMING'] } },
            data: {
                status: 'FAILED',
                failureReason: `confirm_failed: ${paymentSuccessError.message}`,
                version: { increment: 1 },
            },
        });

        await forceReleaseSeatLocks(bookingRecord.scheduleId, seatIds, bookingRecord.fromSeq, bookingRecord.toSeq);

        try {
            const userInfo = await fetchUserForNotification(bookingRecord.userId);
            await bookingProducer.publishBookingFailed({
                bookingId: bookingRecord.id,
                userId: bookingRecord.userId,
                email: userInfo.email,
                firstName: userInfo.firstName,
                scheduleId: bookingRecord.scheduleId,
                reason: 'confirm_seats_failed',
            });
        } catch (failPublishErr) {
            logger.error('Failed to publish BOOKING_FAILED after retries', { bookingId: bookingRecord.id, error: failPublishErr.message });
        }
    }
};

const handlePaymentFailure = async (paymentOrderId, failureReason) => {
    const bookingRecord = await prisma.booking.findUnique({
        where: { paymentOrderId },
        include: { seats: true },
    });

    if (!bookingRecord) {
        logger.warn(`No booking found for paymentOrderId: ${paymentOrderId}`);
        return;
    }

    if (bookingRecord.status === 'FAILED' || bookingRecord.status === 'CANCELLED' || bookingRecord.status === 'EXPIRED') {
        logger.info(`Booking ${bookingRecord.id} already in terminal state: ${bookingRecord.status}`);
        return;
    }

    if (bookingRecord.status !== 'PAYMENT_PENDING') {
        logger.warn(`Booking ${bookingRecord.id} in unexpected status: ${bookingRecord.status}`);
        return;
    }

    const seatIds = bookingRecord.seats.map((s) => s.seatId).sort();

    try {
        await casUpdateBooking(bookingRecord.id, bookingRecord.version, {
            status: 'FAILED',
            failureReason: failureReason || 'payment_failed',
        });
    } catch (casError) {
        if (casError.code === 'STALE_STATE') {
            logger.info(`Booking ${bookingRecord.id} already handled by another process, skipping`);
            return;
        }
        throw casError;
    }

    await saga.compensateHoldSeats(bookingRecord, seatIds);

    await forceReleaseSeatLocks(bookingRecord.scheduleId, seatIds, bookingRecord.fromSeq, bookingRecord.toSeq);

    try {
        const userInfo = await fetchUserForNotification(bookingRecord.userId);
        await bookingProducer.publishBookingFailed({
            bookingId: bookingRecord.id,
            userId: bookingRecord.userId,
            email: userInfo.email,
            firstName: userInfo.firstName,
            scheduleId: bookingRecord.scheduleId,
            reason: failureReason || 'payment_failed',
        });
    } catch (failurePublishErr) {
        logger.error('Failed to publish BOOKING_FAILED after retries', { bookingId: bookingRecord.id, error: failurePublishErr.message });
    }

    logger.info(`Booking ${bookingRecord.id} failed: ${failureReason}`);
};

const cancelBooking = async (targetBookingId, targetUserId) => {
    const bookingRecord = await prisma.booking.findUnique({
        where: { id: targetBookingId },
        include: { seats: true },
    });

    if (!bookingRecord) {
        throw new NotFoundError('Booking not found');
    }

    if (bookingRecord.userId !== targetUserId) {
        throw new NotFoundError('Booking not found');
    }

    if (['CANCELLED', 'CANCELLING', 'FAILED', 'EXPIRED', 'CONFIRMING'].includes(bookingRecord.status)) {
        throw new ConflictError(`Booking is already ${bookingRecord.status}`);
    }

    const seatIds = bookingRecord.seats.map((s) => s.seatId).sort();
    let isRefundInitiated = false;

    try {
        await retryOnConflict(async () => {
            const freshBooking = await prisma.booking.findUnique({ where: { id: targetBookingId } });
            if (!freshBooking) throw new NotFoundError('Booking not found');
            if (['CANCELLED', 'CANCELLING', 'FAILED', 'EXPIRED', 'CONFIRMING'].includes(freshBooking.status)) {
                throw new ConflictError(`Booking is already ${freshBooking.status}`);
            }
            await casUpdateBooking(freshBooking.id, freshBooking.version, {
                status: 'CANCELLING',
                failureReason: 'user_cancelled',
            });
        });
    } catch (claimCancelError) {
        if (claimCancelError.code === 'STALE_STATE' || claimCancelError.statusCode === 409) {
            const freshBooking = await prisma.booking.findUnique({ where: { id: targetBookingId } });
            throw new ConflictError(
                `Booking status changed to ${freshBooking?.status || 'unknown'} while cancelling. Please refresh.`
            );
        }
        throw claimCancelError;
    }

    if (bookingRecord.status === 'CONFIRMED') {
        try {
            await inventoryClient.cancelBooking(bookingRecord.scheduleId, bookingRecord.id, bookingRecord.userId);
        } catch (inventoryCancelError) {
            logger.error(`Failed to release seats in inventory for booking ${bookingRecord.id}`, {
                error: inventoryCancelError.message,
            });
            await prisma.booking.updateMany({
                where: { id: bookingRecord.id, status: 'CANCELLING' },
                data: {
                    status: 'CONFIRMED',
                    failureReason: null,
                    version: { increment: 1 },
                },
            });
            throw inventoryCancelError;
        }

        if (bookingRecord.paymentOrderId) {
            try {
                const refundIdempotencyKey = `${bookingRecord.id}-cancel-refund`;
                await paymentClient.initiateRefund(
                    bookingRecord.paymentOrderId,
                    bookingRecord.totalAmount,
                    'user_cancelled',
                    refundIdempotencyKey
                );
                isRefundInitiated = true;
            } catch (refundError) {
                logger.error(`Failed to initiate refund for booking ${bookingRecord.id}`, {
                    error: refundError.message,
                });
            }
        }
    } else if (['PAYMENT_PENDING', 'SEATS_HELD'].includes(bookingRecord.status)) {
        try {
            await inventoryClient.releaseSeats(bookingRecord.scheduleId, seatIds, bookingRecord.userId, bookingRecord.fromSeq, bookingRecord.toSeq);
        } catch (releaseError) {
            logger.error('Failed to release seats during cancel', { error: releaseError.message });
        }
    }

    await prisma.booking.updateMany({
        where: { id: bookingRecord.id, status: 'CANCELLING' },
        data: {
            status: 'CANCELLED',
            version: { increment: 1 },
        },
    });

    await forceReleaseSeatLocks(bookingRecord.scheduleId, seatIds, bookingRecord.fromSeq, bookingRecord.toSeq);

    try {
        const userInfo = await fetchUserForNotification(bookingRecord.userId);
        await bookingProducer.publishBookingCancelled({
            bookingId: bookingRecord.id,
            userId: bookingRecord.userId,
            email: userInfo.email,
            firstName: userInfo.firstName,
            scheduleId: bookingRecord.scheduleId,
            reason: 'user_cancelled',
            refundAmount: isRefundInitiated ? bookingRecord.totalAmount : 0,
        });
    } catch (cancelPublishErr) {
        logger.error('Failed to publish BOOKING_CANCELLED after retries', { bookingId: bookingRecord.id, error: cancelPublishErr.message });
    }

    logger.info(`Booking ${bookingRecord.id} cancelled by user ${targetUserId}`);

    return {
        bookingId: bookingRecord.id,
        status: 'CANCELLED',
        refundInitiated: isRefundInitiated,
    };
};

const getBooking = async (targetBookingId, targetUserId) => {
    const bookingRecord = await prisma.booking.findUnique({
        where: { id: targetBookingId },
        include: {
            seats: { orderBy: { seatNumber: 'asc' } },
            passengers: true,
        },
    });

    if (!bookingRecord || bookingRecord.userId !== targetUserId) {
        throw new NotFoundError('Booking not found');
    }

    return {
        id: bookingRecord.id,
        status: bookingRecord.status,
        scheduleId: bookingRecord.scheduleId,
        trainId: bookingRecord.trainId,
        trainNumber: bookingRecord.trainNumber,
        trainName: bookingRecord.trainName,
        departureDate: bookingRecord.departureDate,
        totalAmount: bookingRecord.totalAmount,
        seatCount: bookingRecord.seatCount,
        fromStationId: bookingRecord.fromStationId,
        toStationId: bookingRecord.toStationId,
        fromSeq: bookingRecord.fromSeq,
        toSeq: bookingRecord.toSeq,
        paymentOrderId: bookingRecord.paymentOrderId,
        lockExpiresAt: bookingRecord.lockExpiresAt,
        failureReason: bookingRecord.failureReason,
        seats: bookingRecord.seats.map((s) => ({
            seatId: s.seatId,
            seatNumber: s.seatNumber,
            seatType: s.seatType,
            price: s.price,
        })),
        passengers: bookingRecord.passengers.map((p) => ({
            id: p.id,
            name: p.name,
            age: p.age,
            gender: p.gender,
            seatId: p.seatId,
        })),
        createdAt: bookingRecord.createdAt,
        updatedAt: bookingRecord.updatedAt,
    };
};

const getUserBookings = async (targetUserId, { status, page = 1, limit = 10 } = {}) => {
    const skipOffset = (page - 1) * limit;
    const filterConditions = { userId: targetUserId };
    if (status) filterConditions.status = status.toUpperCase();

    const [userBookingList, totalCount] = await Promise.all([
        prisma.booking.findMany({
            where: filterConditions,
            include: {
                seats: { orderBy: { seatNumber: 'asc' } },
                passengers: true,
            },
            orderBy: { createdAt: 'desc' },
            skip: skipOffset,
            take: limit,
        }),
        prisma.booking.count({ where: filterConditions }),
    ]);

    return {
        bookings: userBookingList.map((b) => ({
            id: b.id,
            status: b.status,
            scheduleId: b.scheduleId,
            trainNumber: b.trainNumber,
            trainName: b.trainName,
            departureDate: b.departureDate,
            totalAmount: b.totalAmount,
            seatCount: b.seatCount,
            fromStationId: b.fromStationId,
            toStationId: b.toStationId,
            fromSeq: b.fromSeq,
            toSeq: b.toSeq,
            seats: b.seats.map((s) => ({
                seatId: s.seatId,
                seatNumber: s.seatNumber,
                seatType: s.seatType,
                price: s.price,
            })),
            passengers: b.passengers.map((p) => ({
                name: p.name,
                age: p.age,
                gender: p.gender,
            })),
            createdAt: b.createdAt,
        })),
        pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
        },
    };
};

const verifyPayment = async (targetBookingId, targetUserId, razorpayPaymentId, razorpaySignature) => {
    const bookingRecord = await prisma.booking.findUnique({
        where: { id: targetBookingId },
    });

    if (!bookingRecord || bookingRecord.userId !== targetUserId) {
        throw new NotFoundError('Booking not found');
    }

    if (!bookingRecord.paymentOrderId) {
        throw new BadRequestError('Booking has no payment order');
    }

    if (bookingRecord.status === 'CONFIRMED') {
        return { bookingId: bookingRecord.id, status: 'CONFIRMED', message: 'Already confirmed' };
    }

    if (bookingRecord.status !== 'PAYMENT_PENDING') {
        throw new ConflictError(`Booking is in ${bookingRecord.status} status, cannot verify payment`);
    }

    const verificationResult = await paymentClient.verifyPayment(
        bookingRecord.paymentOrderId,
        razorpayPaymentId,
        razorpaySignature
    );

    logger.info(`Payment verified for booking ${targetBookingId}`, { result: verificationResult });

    return {
        bookingId: bookingRecord.id,
        paymentStatus: verificationResult.status,
    };
};

const handleScheduleCancelled = async (cancelledScheduleId) => {
    if (!cancelledScheduleId) {
        logger.warn('handleScheduleCancelled called without cancelledScheduleId');
        return;
    }

    const activeBookings = await prisma.booking.findMany({
        where: {
            scheduleId: cancelledScheduleId,
            status: { in: ['PENDING', 'SEATS_HELD', 'PAYMENT_PENDING', 'CONFIRMED'] },
        },
        include: { seats: true },
    });

    if (activeBookings.length === 0) {
        logger.info(`No active bookings to cancel for schedule ${cancelledScheduleId}`);
        return;
    }

    logger.info(`Cancelling ${activeBookings.length} active booking(s) due to schedule cancellation`, { scheduleId: cancelledScheduleId });

    for (const activeBooking of activeBookings) {
        try {
            const claimed = await prisma.booking.updateMany({
                where: {
                    id: activeBooking.id,
                    version: activeBooking.version,
                    status: { in: ['PENDING', 'SEATS_HELD', 'PAYMENT_PENDING', 'CONFIRMED'] },
                },
                data: {
                    status: 'CANCELLED',
                    failureReason: 'schedule_cancelled',
                    version: { increment: 1 },
                },
            });

            if (claimed.count === 0) {
                logger.info(`Booking ${activeBooking.id} already handled, skipping schedule-cancel`);
                continue;
            }

            const seatIds = activeBooking.seats.map((s) => s.seatId).sort();

            await forceReleaseSeatLocks(activeBooking.scheduleId, seatIds, activeBooking.fromSeq, activeBooking.toSeq);

            if (activeBooking.status === 'CONFIRMED' && activeBooking.paymentOrderId) {
                try {
                    const refundIdempotencyKey = `${activeBooking.id}-schedule-cancel-refund`;
                    await paymentClient.initiateRefund(
                        activeBooking.paymentOrderId,
                        activeBooking.totalAmount,
                        'schedule_cancelled',
                        refundIdempotencyKey
                    );
                } catch (scheduleRefundErr) {
                    logger.error(`Failed to initiate refund for booking ${activeBooking.id} during schedule cancellation`, {
                        error: scheduleRefundErr.message,
                    });
                }
            }

            try {
                const userInfo = await fetchUserForNotification(activeBooking.userId);
                await bookingProducer.publishBookingCancelled({
                    bookingId: activeBooking.id,
                    userId: activeBooking.userId,
                    email: userInfo.email,
                    firstName: userInfo.firstName,
                    scheduleId: activeBooking.scheduleId,
                    reason: 'schedule_cancelled',
                    refundAmount: activeBooking.status === 'CONFIRMED' ? activeBooking.totalAmount : 0,
                });
            } catch (publishCancelledErr) {
                logger.error('Failed to publish BOOKING_CANCELLED for schedule cancellation', {
                    bookingId: activeBooking.id,
                    error: publishCancelledErr.message,
                });
            }

            logger.info(`Booking ${activeBooking.id} cancelled due to schedule cancellation`);
        } catch (cancelActiveErr) {
            logger.error(`Failed to cancel booking ${activeBooking.id} during schedule cancellation`, {
                error: cancelActiveErr.message,
            });
        }
    }
};

const createBookingService = createBooking;
const getBookingService = getBooking;
const getUserBookingsService = getUserBookings;
const cancelBookingService = cancelBooking;
const verifyPaymentService = verifyPayment;

const bookingService = {
    createBooking,
    createBookingService,
    handlePaymentSuccess,
    handlePaymentFailure,
    handleScheduleCancelled,
    cancelBooking,
    cancelBookingService,
    getBooking,
    getBookingService,
    getUserBookings,
    getUserBookingsService,
    verifyPayment,
    verifyPaymentService,
    casUpdateBooking,
    retryOnConflict,
    fetchUserForNotification,
    fetchStationName,
    checkIdempotency,
    saveIdempotency,
};

export {
    createBooking,
    createBookingService,
    handlePaymentSuccess,
    handlePaymentFailure,
    handleScheduleCancelled,
    cancelBooking,
    cancelBookingService,
    getBooking,
    getBookingService,
    getUserBookings,
    getUserBookingsService,
    verifyPayment,
    verifyPaymentService,
    casUpdateBooking,
    retryOnConflict,
    fetchUserForNotification,
    fetchStationName,
    checkIdempotency,
    saveIdempotency,
};

export default bookingService;