import { logger } from "../config/logger.js";
import { RedisKey } from "../config/Redis/key.js";
import { redis } from "../config/Redis/redis.js";

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

const buildLockKeys = (targetScheduleId, seatIdList, fromSequence, toSequence) => {
    const routeSuffix = (fromSequence && toSequence) ? `${fromSequence}:${toSequence}` : '';
    return [...seatIdList]
        .sort()
        .map((seatId) => RedisKey.bookingSeatLock(targetScheduleId, seatId, routeSuffix));
};

const acquireSeatLocks = async (targetScheduleId, seatIdList, lockIdentifier, timeoutSeconds, fromSequence, toSequence) => {
    const redisKeys = buildLockKeys(targetScheduleId, seatIdList, fromSequence, toSequence);
    const generatedLockValue = `${lockIdentifier}:${Date.now()}`;
    try {
        const evalResult = await redis.eval(ACQUIRE_SCRIPT, redisKeys.length, ...redisKeys, generatedLockValue, timeoutSeconds);
        if (evalResult === 1) {
            logger.info(`Distributed locks acquired for identifier ${lockIdentifier}`, {
                scheduleId: targetScheduleId,
                seatCount: seatIdList.length,
                ttlSec: timeoutSeconds,
            });
            return { acquired: true, lockValue: generatedLockValue };
        }
        logger.info('Failed to acquire locks, seats already locked', {
            scheduleId: targetScheduleId,
            lockIdentifier,
        });
        return { acquired: false, lockValue: null };
    } catch (lockError) {
        logger.error('Error acquiring distributed locks', {
            error: lockError.message,
            scheduleId: targetScheduleId,
            lockIdentifier,
        });
        return { acquired: false, lockValue: null };
    }
};

const releaseSeatLocks = async (targetScheduleId, seatIdList, currentLockValue, fromSequence, toSequence) => {
    if (!currentLockValue) return;
    const redisKeys = buildLockKeys(targetScheduleId, seatIdList, fromSequence, toSequence);
    try {
        const releasedCount = await redis.eval(RELEASE_SCRIPT, redisKeys.length, ...redisKeys, currentLockValue);
        logger.info(`Released ${releasedCount} distributed lock(s)`, { scheduleId: targetScheduleId });
    } catch (releaseError) {
        logger.error('Error releasing distributed locks', {
            error: releaseError.message,
            scheduleId: targetScheduleId,
        });
    }
};

const forceReleaseSeatLocks = async (targetScheduleId, seatIdList, fromSequence, toSequence) => {
    if (!seatIdList || !seatIdList.length) return;
    const redisKeys = buildLockKeys(targetScheduleId, seatIdList, fromSequence, toSequence);
    try {
        const deletedCount = await redis.del(...redisKeys);
        logger.info(`Force released ${deletedCount} distributed lock(s)`, { scheduleId: targetScheduleId, seatCount: seatIdList.length });
    } catch (forceReleaseError) {
        logger.error('Error force releasing distributed locks', {
            error: forceReleaseError.message,
            scheduleId: targetScheduleId,
        });
    }
};

const releasedSeatLocks = releaseSeatLocks;

const distributedLockService = {
    acquireSeatLocks,
    releaseSeatLocks,
    releasedSeatLocks,
    forceReleaseSeatLocks,
};

export { acquireSeatLocks, releaseSeatLocks, releasedSeatLocks, forceReleaseSeatLocks };

export default distributedLockService;
