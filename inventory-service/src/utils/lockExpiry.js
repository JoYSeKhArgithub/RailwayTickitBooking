import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { config } from '../config/root.js';
import { recountAndPublish, recomputeSegmentSeatStatuses } from '../services/inventory.service.js';

let intervalHandle = null;

export const ADVISORY_LOCK_ID = 800001;

export const tryAcquireLeadership = async () => {
    try {
        const result = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) AS acquired`;
        return result[0]?.acquired === true;
    } catch (leadershipErr) {
        logger.error('Failed to acquire lock expiry leadership', { error: leadershipErr.message });
        return false;
    }
};

export const releaseLeadership = async () => {
    try {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
    } catch (releaseErr) {
        logger.error('Failed to release lock expiry leadership', { error: releaseErr.message });
    }
};

export const cleanExpiredLocks = async () => {
    const isInstanceLeader = await tryAcquireLeadership();
    if (!isInstanceLeader) {
        logger.debug('Skipping lock expiry job — another instance is the leader');
        return;
    }

    try {
        try {
            const expiredSegmentLocks = await prisma.seatSegmentLock.findMany({
                where: {
                    status: 'LOCKED',
                    lockedExpiresAt: { lt: new Date() },
                },
                select: { id: true, scheduleId: true, seatId: true },
            });

            if (expiredSegmentLocks.length > 0) {
                logger.info(`Found ${expiredSegmentLocks.length} expired segment lock(s) to clean up`);

                const segmentIds = expiredSegmentLocks.map((lockItem) => lockItem.id);
                await prisma.$executeRaw`
                    DELETE FROM seat_segment_locks WHERE id = ANY(${segmentIds}::text[])
                `;

                const affectedScheduleSeats = new Map();
                for (const lockItem of expiredSegmentLocks) {
                    if (!affectedScheduleSeats.has(lockItem.scheduleId)) {
                        affectedScheduleSeats.set(lockItem.scheduleId, new Set());
                    }
                    affectedScheduleSeats.get(lockItem.scheduleId).add(lockItem.seatId);
                }

                for (const [targetScheduleId, seatIdSet] of affectedScheduleSeats) {
                    await prisma.$transaction(async (tx) => {
                        await recomputeSegmentSeatStatuses(tx, targetScheduleId, [...seatIdSet]);
                    });
                    await recountAndPublish(targetScheduleId);
                }

                logger.info(`Cleaned ${expiredSegmentLocks.length} expired segment lock(s)`);
            }
        } catch (segmentCleanupErr) {
            logger.error('Segment lock expiry cleanup failed', { error: segmentCleanupErr.message });
        }

        const expiredSeats = await prisma.seatInventory.findMany({
            where: {
                status: 'LOCKED',
                lockExpiresAt: { lt: new Date() },
            },
            select: {
                id: true,
                scheduleId: true,
                seatNumber: true,
            },
        });

        if (expiredSeats.length === 0) return;

        logger.info(`Found ${expiredSeats.length} expired seat lock(s) to clean up`);

        const bySchedule = {};
        for (const seatRecord of expiredSeats) {
            if (!bySchedule[seatRecord.scheduleId]) {
                bySchedule[seatRecord.scheduleId] = [];
            }
            bySchedule[seatRecord.scheduleId].push(seatRecord);
        }

        for (const [scheduleIdKey, scheduledSeatsList] of Object.entries(bySchedule)) {
            try {
                const seatPkIds = scheduledSeatsList.map((singleSeat) => singleSeat.id);

                await prisma.$executeRaw`
                    UPDATE seat_inventories
                    SET status = 'AVAILABLE', "lockedBy" = NULL,
                        "lockedAt" = NULL, "lockExpiresAt" = NULL,
                        version = version + 1, "updatedAt" = NOW()
                    WHERE id = ANY(${seatPkIds}::text[])
                    AND status = 'LOCKED'
                `;

                await recountAndPublish(scheduleIdKey);

                logger.info(`Released ${scheduledSeatsList.length} expired lock(s) for schedule ${scheduleIdKey}`);
            } catch (inventoryCleanupErr) {
                logger.error(`Failed to clean expired locks for schedule ${scheduleIdKey}`, {
                    error: inventoryCleanupErr.message,
                });
            }
        }
    } catch (generalLockCleanupErr) {
        logger.error('Lock expiry cleanup failed', { error: generalLockCleanupErr.message });
    } finally {
        await releaseLeadership();
    }
};

export const startLockExpiryJob = () => {
    cleanExpiredLocks();

    intervalHandle = setInterval(cleanExpiredLocks, config.LOCK_EXPIRY_INTERVAL_MS);
    logger.info(`Lock expiry job started (interval: ${config.LOCK_EXPIRY_INTERVAL_MS}ms)`);
};

export const stopLockExpiryJob = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        logger.info('Lock expiry job stopped');
    }
};

export default {
    ADVISORY_LOCK_ID,
    tryAcquireLeadership,
    releaseLeadership,
    cleanExpiredLocks,
    startLockExpiryJob,
    stopLockExpiryJob,
};
