import { logger } from "../config/logger.js";
import { redis } from "../config/Redis/redis.js";

const TOKEN_BUCKET = `
local key            = KEYS[1]
local capacity        = tonumber(ARGV[1])
local refill_per_sec  = tonumber(ARGV[2])
local now_ms          = tonumber(ARGV[3])
local requested       = tonumber(ARGV[4])
local ttl_sec         = tonumber(ARGV[5])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])

if tokens == nil then
     tokens = capacity
     ts = now_ms
end

local elapsed_sec = math.max(0, (now_ms - ts) / 1000)
tokens = math.min(capacity, tokens + elapsed_sec * refill_per_sec)

local allowed = 0
if tokens >= requested then
     tokens = tokens - requested
     allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', now_ms)
redis.call('EXPIRE', key, ttl_sec)

local retry_after = 0
if allowed == 0 then
     local deficit = requested - tokens
     retry_after = math.ceil(deficit / refill_per_sec)
end

return { allowed, tostring(tokens), retry_after }
`;


if(redis && typeof redis.tokenBucket !== 'function'){
    redis.defineCommand('tokenBucket',{
        numberOfKeys: 1,
        lua: TOKEN_BUCKET
    })
}

const localBlacklist = new Map();

setInterval(()=>{
    const now = Date.now();
    for(const [key,expiry] of localBlacklist.entries()){
        if(now>expiry) localBlacklist.delete(key);
    }
},5000);

export async const consume = (key,capacity,refillPerSec,opts={})=>{
    const cost = opts.cost || 1;
    const failOpen = opts.failOpen !== undefined ?opts.failOpen : true;

    const ttlSec = Math.max(60,Math.ceil(capacity/refillPerSec)+60);
    const blockedUntill = localBlacklist.get(key);
    if(blockedUntill && Date.now() < blockedUntill){
        return {
            allowed: false,
            remaining: 0,
            retryAfter: Math.ceil((blockedUntill - Date.now())/1000),
            localBlocked: true
        }
    }

    try {
        if(!redis || redis.status !== 'ready'){
            throw new Error('Redis client is not ready');
        }

        const [allowed,remainingStr,retryAfter] = await redis.tokenBucket(
            key,
            capacity,
            refillPerSec,
            Date.now(),
            cost,
            ttlSec
        );

        const isAllowed = allowed === 1;
        if(!isAllowed){
            const blockDurationMs = Math.min(5000,Number(retryAfter)*1000);
            localBlacklist.set(key,Date.now()+blockDurationMs);
        }

        return {
            allowed: isAllowed,
            remaining: Math.floor(Number(remainingStr)),
            retryAfter: Number(retryAfter)
        }
    } catch (error) {
        logger.error(`tokenBucket error for key=${key}:`, err.message);

        if(failOpen){
            return {allowed: true, remaining: capacity,retryAfter: 0,degraded: true}
        }
        return {allowed: false,remaining: 0,retryAfter: 5,degraded: true}
    }
}