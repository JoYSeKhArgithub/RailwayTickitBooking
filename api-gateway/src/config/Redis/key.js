export const RedisKey = {
    ipRateLimit: (mode,ip)=> `rl:ip:${mode}:${ip}`,
    userRateLimit: (mode, id) => `rl:user:${mode}:${id}`,
    endPointRateLimit: (name,key) => `rl:endpoint:${name}:${key}`,
    queueKey: (name)=>`queue:${name}`,
    memberKey: (name,id)=>`queue:${name}:member:${id}`,
    queueToken: (name,userId)=> `queue:${name}:token:${userId}`,
    queueBookingUserId: (userId)=>`queue:booking:token:${userId}`,
    queueBooking: ()=> `queue:booking`
}