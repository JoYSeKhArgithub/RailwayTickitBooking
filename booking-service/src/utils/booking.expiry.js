import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { config } from '../config/root.js';
import { redis } from '../config/redis.js';
import { forceReleaseSeatLocks } from './distributedLock.js';
import { compensateAll } from '../services/saga.service.js';
import { userClient } from '../services/userClient.js';
import { bookingProducer } from '../kafka/producer/booking.producer.js';

export const fetchUserForNotification = async (targetUserId) => {
    try {
        const userAccount = await userClient.getUserById(targetUserId);
        return userAccount ? { email: userAccount.email, firstName: userAccount.firstName } : {};
    } catch (notificationError) {
        logger.warn('Failed to enrich expiry event with user details', {
            userId: targetUserId,
            error: notificationError.message,
        });
        return {};
    }
};

let expiryInterval = null;

const EXPIRY_LEADER_KEY = 'booking:expiry-job:leader';
const LEADER_TTL_SECONDS = 25;

export const tryAcquireLeadership = async () => {
    try {
        const lockAcquired = await redis.set(EXPIRY_LEADER_KEY, process.pid.toString(), 'NX', 'EX', LEADER_TTL_SECONDS);
        return lockAcquired === 'OK';
    } catch (leaderError) {
        logger.error('Failed to acquire expiry job leadership', { error: leaderError.message });
        return false;
    }
};

export const cleanExpiredBookings = async () => {
    const isLeaderInstance = await tryAcquireLeadership();
    if (!isLeaderInstance) {
        logger.debug('Skipping expiry job — another instance is the leader');
        return;
    }

    try {
        const expiredBookingsList = await prisma.booking.findMany({
            where: {
                status: { in: ['PENDING', 'SEATS_HELD', 'PAYMENT_PENDING'] },
                lockExpiresAt: { lt: new Date() },
            },
            include: { seats: true },
        });

        if (expiredBookingsList.length === 0) return;

        logger.info(`Found ${expiredBookingsList.length} expired booking(s) to clean up`);

        for (const expiredBooking of expiredBookingsList) {
            try {
                const seatIdList = expiredBooking.seats.map((seatItem) => seatItem.seatId).sort();

                const claimedRecord = await prisma.booking.updateMany({
                    where: {
                        id: expiredBooking.id,
                        version: expiredBooking.version,
                        status: { in: ['PENDING', 'SEATS_HELD', 'PAYMENT_PENDING'] },
                    },
                    data: {
                        status: 'EXPIRED',
                        failureReason: 'booking_timeout',
                        version: { increment: 1 },
                    },
                });

                if (claimedRecord.count === 0) {
                    logger.info(`Booking ${expiredBooking.id} already handled by another process, skipping expiry`);
                    continue;
                }

                await compensateAll(expiredBooking, seatIdList);

                await forceReleaseSeatLocks(expiredBooking.scheduleId, seatIdList, expiredBooking.fromSeq, expiredBooking.toSeq);

                try {
                    const userDetails = await fetchUserForNotification(expiredBooking.userId);
                    await bookingProducer.publishBookingFailed({
                        bookingId: expiredBooking.id,
                        userId: expiredBooking.userId,
                        email: userDetails.email,
                        firstName: userDetails.firstName,
                        scheduleId: expiredBooking.scheduleId,
                        reason: 'booking_timeout',
                    });
                } catch (publishErr) {
                    logger.error('Failed to publish BOOKING_FAILED for expired booking', {
                        bookingId: expiredBooking.id,
                        error: publishErr.message,
                    });
                }

                logger.info(`Expired booking ${expiredBooking.id} cleaned up`, {
                    previousStatus: expiredBooking.status,
                });
            } catch (singleBookingCleanError) {
                logger.error(`Failed to clean up expired booking ${expiredBooking.id}`, {
                    error: singleBookingCleanError.message,
                });
            }
        }
    } catch (batchCleanError) {
        logger.error('Error in booking expiry job', { error: batchCleanError.message });
    }
};

export const startBookingExpiryJob = () => {
    cleanExpiredBookings();

    expiryInterval = setInterval(cleanExpiredBookings, config.BOOKING_EXPIRY_CHECK_INTERVAL_MS);
    logger.info(
        `Booking expiry job started (interval: ${config.BOOKING_EXPIRY_CHECK_INTERVAL_MS}ms)`
    );
};

export const stopBookingExpiryJob = () => {
    if (expiryInterval) {
        clearInterval(expiryInterval);
        expiryInterval = null;
        logger.info('Booking expiry job stopped');
    }
};