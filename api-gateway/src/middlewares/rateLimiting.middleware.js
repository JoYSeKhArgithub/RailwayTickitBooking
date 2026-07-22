import { logger } from "../config/logger.js";
import { failOpen, getActiveMode, tiers } from "../config/RateLimit.config.js";
import { RedisKey } from "../config/Redis/key.js";
import { consume } from "../lib/tokenBucket.js";
import { ServiceUnavailableError, TooManyRequestsError } from "../utils/error.js";

export const setHeader = (res,capacity,remaining,retryAfter)=>{
    res.setHeader('X-RateLimiting-Limit',capacity);
    res.setHeader('X-RateLimit-Remaining',Math.max(0,remaining));
    if(retryAfter>0) res.setHeader('Retry-After',retryAfter);
}

export const ipRateLimit = ()=>{
    return async (req,res,error)=>{
        const mode = getActiveMode();
        const { capacity, refillPerSec } = tiers[mode];
        const ip = req.ip || req.connection.remoteAddress;

        const result = await consume(RedisKey.ipRateLimit(mode,ip),capacity,refillPerSec,{
            failOpen: failOpen.default
        })
        setHeader(res,capacity,result.remaining,result.retryAfter);
        if(!result.allowed){
            logger.warn(`IP rate limit exceeded ip=${ip} mode=${mode}`);
            return next(
                new TooManyRequestsError(
                    `Too many requests. Please try again in ${result.retryAfter} seconds`,
                    result.retryAfter
                )
            )
        }
        next();
    }
}

export const userRateLimit = ()=>{
    if(!req.user || !req.user.id) return next();

    const mode = getActiveMode();
    const {capacity,refillPerSec} = tiers[mode];
    const result = await consume(RedisKey.userRateLimit(mode,req.user.id),capacity,refillPerSec,{
        failOpen: failOpen.default
    });
    setHeader(res,capacity,result.remaining,result.retryAfter);

    if(!result.allowed){
        logger.warn(`User rate limit exceeded user=${req.user.id} mode=${mode}`);
        return next(
            new TooManyRequestsError(
                `Too many requests. Please try again in ${result.retryAfter} seconds`,
                result.retryAfter
            )
        )
    }
    next();
}

export const endpointRateLimit = (tierName,keyFn)=>{
    const tierConfig = tiers.endpoint[tierName];
    if(!tierConfig){
        throw new Error(`Unknown rate Limit tier: ${tierName}`)
    }
    const shouldFailOpen = failOpen[tierName] !== undefined ? failOpen[tierName]: failOpen.default;

    return async(req,res,next)=>{
        const partitionKey = keyFn? keyFn(req):req.ip;
        const result = await consume(RedisKey.endPointRateLimit(tierName,partitionKey),tierConfig.capacity,tierConfig.refillPerSec,{
            failOpen: shouldFailOpen,
        });

        setHeader(res,tierConfig.capacity,result.remaining,result.retryAfter);

        if(!result.allowed){
            logger.warn(`Endpoint rate limit exceeded tier=${tierName} key=${partitionKey}`);

            if(result.degraded && !shouldFailOpen){
                return next(new ServiceUnavailableError('Booking system temporarily busy. Please retry shortly.'))
            }

            return next(
                new TooManyRequestsError(
                    `Too many requests to this endpoint. Please try again in ${result.retryAfter} seconds`,
                    result.retryAfter
                )
            );
        }
        next();
    }
}


export const combinedRateLimit =({ endpointTier, endpointKeyFn } = {}) =>{
    const ipLimiter = ipRateLimit();
    const userLimiter = userRateLimit();
    const endpointLimiter = endpointTier ? endpointRateLimit(endpointTier, endpointKeyFn) : null;

    return (req, res, next) => {
        ipLimiter(req, res, (err) => {
            if (err) return next(err);
            userLimiter(req, res, (err2) => {
                if (err2) return next(err2);
                if (endpointLimiter) return endpointLimiter(req, res, next);
                next();
            });
        });
    };
}