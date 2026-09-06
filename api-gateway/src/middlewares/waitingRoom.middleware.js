import crypto from 'crypto';
import { getActiveMode, waitingRoom as waitingRoomConfig } from '../config/RateLimit.config.js';
import { redis } from '../config/Redis/redis.js';
import { RedisKey } from '../config/Redis/key.js';
import { config } from '../config/root.js';
import { logger } from '../config/logger.js';

const getAdmissionSecret = () => config.WAITING_ROOM_SECRET || process.env.WAITING_ROOM_SECRET || 'tatkal-waiting-room-secret-key-super-secure';

export function signToken(payload) {
    const body = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', getAdmissionSecret()).update(body).digest('hex');
    return Buffer.from(`${body}.${sig}`).toString('base64url');
}

export function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const raw = Buffer.from(token, 'base64url').toString('utf8');
        const lastDotIndex = raw.lastIndexOf('.');
        if (lastDotIndex === -1) return null;

        const body = raw.substring(0, lastDotIndex);
        const sig = raw.substring(lastDotIndex + 1);
        const expected = crypto.createHmac('sha256', getAdmissionSecret()).update(body).digest('hex');
        if (sig !== expected) return null;

        const payload = JSON.parse(body);
        if (!payload.exp || payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

export const waitingRoomMiddleware = ({ queueName = 'booking' } = {}) => {
    return async (req, res, next) => {
        if (getActiveMode() !== 'tatkal') return next();

        const admissionToken = req.headers['x-admission-token'];
        const userId = (req.user?.id ? req.user.id.toString() : null) || req.ip;

        if (admissionToken) {
            const payload = verifyToken(admissionToken);
            if (payload && payload.userId === userId) {
                return next();
            }
        }

        try {
            if (!redis || redis.status !== 'ready') {
                throw new Error('Redis not ready');
            }

            const queueKey = RedisKey.queueKey(queueName);
            const memberKey = RedisKey.memberKey(queueName, userId);

            const alreadyQueued = await redis.get(memberKey);
            if (!alreadyQueued) {
                await redis.zadd(queueKey, Date.now(), userId);
                await redis.set(memberKey, '1', 'EX', waitingRoomConfig.queueTtlSec);
            }

            const rank = await redis.zrank(queueKey, userId);
            const total = await redis.zcard(queueKey);

            return res.status(202).json({
                status: 'queued',
                position: (rank !== null && rank !== undefined ? rank : total) + 1,
                totalInQueue: total,
                pollAfterMs: 2000,
                message: 'High demand right now. Hold on to your position -- do not refresh.'
            });
        } catch (error) {
            logger.error(`Waiting room gate error, falling open: ${error.message}`);
            next();
        }
    };
};

export const waitingRoom = waitingRoomMiddleware;

export const startAdmissionWorker = ({ queueName = 'booking' } = {}) => {
    const queueKey = RedisKey.queueKey(queueName);

    const interval = setInterval(async () => {
        if (getActiveMode() !== 'tatkal') return;

        try {
            if (!redis || redis.status !== 'ready') return;

            // zpopmin returns [member1, score1, member2, score2, ...]
            const batch = await redis.zpopmin(queueKey, waitingRoomConfig.admissionBatchSize);
            if (!batch || batch.length === 0) return;

            const userIds = [];
            for (let i = 0; i < batch.length; i += 2) {
                userIds.push(batch[i]);
            }

            for (const userId of userIds) {
                const token = signToken({
                    userId,
                    exp: Date.now() + waitingRoomConfig.admissionTokenTtlSec * 1000,
                });
                await redis.set(RedisKey.queueToken(queueName, userId), token, 'EX', waitingRoomConfig.admissionTokenTtlSec);
                await redis.del(RedisKey.memberKey(queueName, userId));
            }

            if (userIds.length > 0) {
                logger.info(`Waiting room admitted ${userIds.length} users into ${queueName}`);
            }
        } catch (error) {
            logger.error('Admission worker error: ', error);
        }
    }, waitingRoomConfig.admissionIntervalMs);

    return () => clearInterval(interval);
};

export const checkAdmissionStatus = async (req, res) => {
    const userId = (req.user?.id ? req.user.id.toString() : null) || req.ip;
    const queueName = req.query?.queue || 'booking';

    try {
        if (!redis || redis.status !== 'ready') {
            return res.status(503).json({
                success: false,
                error: 'Service temporarily unavailable'
            });
        }

        const token = await redis.get(RedisKey.queueToken(queueName, userId));
        if (token) {
            return res.json({
                status: 'admitted',
                admissionToken: token
            });
        }

        const queueKey = RedisKey.queueKey(queueName);
        const rank = await redis.zrank(queueKey, userId);
        if (rank === null) {
            return res.json({
                status: 'not_queued',
                message: 'No active queue position or token found'
            });
        }

        const total = await redis.zcard(queueKey);
        return res.json({
            status: 'queued',
            position: rank + 1,
            totalInQueue: total,
            pollAfterMs: 2000
        });
    } catch (error) {
        logger.error('Error while checking admission status: ', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};