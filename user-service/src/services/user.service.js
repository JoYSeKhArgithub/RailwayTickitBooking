import { prisma } from "../config/prisma.js"
import { RedisKey } from "../config/Redis/key.js";
import { redis } from "../config/Redis/redis.js";
import { config } from "../config/root.js";

const getProfileT = async(userId)=>{
    const storedOtp = await redis.get(RedisKey.user(userId));
    if(storedOtp){
        return JSON.parse(storedOtp)
    }
    const userProfile = await prisma.user.findUnique({
        where: {
            id: userId
        }
    })

    const {password: _password, ...safeuser} = userProfile;
    await redis.set(RedisKey.user(userId),JSON.stringify(safeuser),'EX',config.REDIS_USER_TTL)
    return safeuser;
}

export default {getProfileT}