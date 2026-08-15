export const RedisKey = {
    bookingSeatLock: (scheduleId,seatId,suffix)=> `booking:lock:seat:${scheduleId}:${seatId}:${suffix}`
}