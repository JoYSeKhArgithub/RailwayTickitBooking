import { logger } from "../config/logger";
import { RedisKey } from "../config/Redis/key";
import { redis } from "../config/Redis/redis";

const ACQUIRE_SCRIPT = `
local lockValue = ARGV[1]
local ttl = tonumber(ARGV[2])
local acquired = {}

for i, key in ipairs(KEYS) do
     local result = redis.call('SET', key, lockValue, 'NX', 'EX', ttl)
     if not result then
          for j = 1, #acquired do
               redis.call('DEL', acquired[j])
          end
          return 0
     end
     table.insert(acquired, key)
end

return 1
`;


const RELEASE_SCRIPT = `
local lockValue = ARGV[1]
local released = 0

for i, key in ipairs(KEYS) do
     local currentValue = redis.call('GET', key)
     if currentValue == lockValue then
          redis.call('DEL', key)
          released = released + 1
     end
end

return released
`;


const buildLockKeys = (scheduleId,seatIds,fromSeq,toSeq)=>{
    const suffix = (fromSeq && toSeq)? `${fromSeq}:${toSeq}`: '';
    return [...seatIds]
            .sort()
        .map(seatId => RedisKey.bookingSeatLock(scheduleId,seatId,suffix))
}

const acquireSeatLocks = async(scheduleId,seatIds,bookingId,ttlSec,fromSeq,toSeq)=>{
    const keys = buildLockKeys(scheduleId,seatIds,fromSeq,toSeq);
    const lockValue = `${bookingId}:${Date.now()}`;
    try {
        const data = await redis.eval(ACQUIRE_SCRIPT,keys.length,...keys,lockValue,ttlSec);
        if(data === 1){
            logger.info(`Distrributed locks acquires for booking ${bookingId}`,{
                scheduleId,
                seatCount: seatIds.length,
                ttlSec,
            });
            return {acquired: true, lockValue};
        }
        logger.info(`Failed to acquire locks, seats already locked`, {
            scheduleId,
            bookingId,
        });
        return { acquired: false, lockValue: null };
    } catch (error) {
        logger.error('Error acquiring distributed locks', {
            error: error.message,
            scheduleId,
            bookingId,
        });
        return { acquired: false, lockValue: null };
    }
}

const releasedSeatLocks = async (scheduleId, seatIds, lockValue, fromSeq, toSeq)=>{
    if (!lockValue) return;
    const keys = buildLockKeys(scheduleId, seatIds, fromSeq, toSeq);
    try {
        const released = await redis.eval(RELEASE_SCRIPT, keys.length, ...keys, lockValue);
        logger.info(`Released ${released} distributed lock(s)`, { scheduleId });
    } catch (error) {
        logger.error('Error releasing distributed locks', {
            error: error.message,
            scheduleId,
        });
    }
}

export default {
    acquireSeatLocks,
    releasedSeatLocks
}
