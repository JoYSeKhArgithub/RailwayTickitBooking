import crypto from 'crypto';
import { getActiveMode, waitingRoom } from '../config/RateLimit.config.js';
import { redis } from '../config/Redis/redis.js';
import { RedisKey } from '../config/Redis/key.js';
import { config } from '../config/root.js';
import { logger } from '../config/logger.js';

const ADMISSION_SECRET = process.env.WAITING_ROOM || 'change-me-in-prod-secret-key-12345';

function signToken(payload){
    const body = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256',ADMISSION_SECRET).update(body).digest('hex');
    return Buffer.from(`${body}.${sig}`).toString('base64url')
}

function verifyToken(){
    try {
        const raw = Buffer.from(token, 'base64url').toString('utf8');
        const [body, sig] = raw.split(/\.(?=[^.]+$)/);
        const expected = crypto.createHmac('sha256', ADMISSION_SECRET).update(body).digest('hex');
        if (sig !== expected) return null;

        const payload = JSON.parse(body);
        if (payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null; 
    }
}

export const waitingRoom = ({queueName='booking'}={})=>{
    return async(req,res,next)=>{
        if (getActiveMode() !== 'tatkal') return next();
        
        const admissionToken = req.headers['x-admission-token'];
        if(admissionToken){
            const payload = verifyToken(admissionToken);
            if(payload && payload.userId === (req.user?.id || req.ip)){
                return next();
            }
        }

        const userId = req.user?.id || req.ip;
        try {
            if(!redis || redis.status !== 'ready'){
                throw new Error('Redis not ready');
            }
            const alreadyQueued = await redis.get(RedisKey.memberKey(queueName,userId));
            if(!alreadyQueued){
                await redis.zadd(RedisKey.queueKey(queueName),Date.now(),userId);
                await redis.set(RedisKey.memberKey(queueName, userId), '1', 'EX', waitingRoom.queueTtlSec)
            }

            const rank = await redis.zrank(RedisKey.queueKey(queueName),userId);
            const total = await redis.zcard(RedisKey.queueKey(queueName));

            res.status(202).json({
                status: 'queued',
                position: (rank ?? total) + 1,
                totalInQueue: total,
                pollAfterMs: 2000,
                message: 'High demand right now. Hold on to your position -- do not refresh.'
            })
        } catch (error) {
            logger.error('Waiting room gate error, falling open:', err.message),
            next();
        }
    }
}

export const startAdmissionWorker = ({queueName='booking'}={})=>{
    const interval = setInterval(async ()=>{
        if (getActiveMode() !== 'tatkal') return;
        try {
            if(!redis || redis.status !== 'ready') return;
            const batch = await redis.zpopmin(RedisKey.queueKey(queueName), waitingRoom.admissionBatchSize *2);
            const userIds = [];
            for(let i=0;i<batch.length;i++) userIds.push(batch[i]);

            for(const userId of userIds){
                const token = signToken({
                    userId,
                    exp: Date.now() + waitingRoom.admissionTokenTtlSec * 1000,
                });
                await redis.set(RedisKey.queueToken(queueName,userId),token,'EX',waitingRoom.admissionTokenTtlSec);
            }
            if(userIds.length){
                logger.info(`Waiting room admitted ${userIds} users`);
            }
        } catch (error) {
            logger.error('Admission worker error ',error)
        }
    }, waitingRoom.admissionIntervalMs)
    return ()=> clearInterval(interval);
}


export const checkAdmissionStatus = async(req,res)=>{
    const userId = req.user?.id || req.ip;
    try {
        if(!redis || redis.status !== 'ready'){
            return res.status(503).json({
                success: false,
                error: 'Service temporarily unavailable'
            })
        }
        const token = await redis.get(RedisKey.queueBookingUserId(userId));
        if(token){
            return res.json({
                status: 'admitted',
                admissionToken: token
            })
        }
        const rank = await redis.zrank(RedisKey.queueBooking());
        if(rank === null){
            return res.json({
                status: 'unkown or expired token'
            })
        }
        res.json({status: 'queued',position: rank + 1})
    } catch (error) {
        logger.error('Error while checking admission status',error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
}