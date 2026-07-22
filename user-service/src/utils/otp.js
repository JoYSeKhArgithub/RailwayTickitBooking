import crypto from 'crypto';
import { config } from '../config/root.js';
import otpGenerator from 'otp-generator';
import { redis } from '../config/Redis/redis.js';
import { RedisKey } from '../config/Redis/key.js';
import { TooManyRequestsError } from './error.js';

const OTP_TTL = parseInt(config.OTP_TTL || '300', 10);
const RATE_MAX = parseInt(config.OTP_RATE_MAX_PER_HOUR || '5', 10);
const ATTEMPT_MAX = parseInt(config.OTP_MAX_VERIFY_ATTEMPTS || '5', 10);

const hmacFor=(email,otp)=>{
    return crypto.createHash('sha256', config.OTP_HMAC_SECRET).update(email + ":" + otp).digest('hex');
}

export const generateAndStoreOTP = async(meta)=>{
    const sendCount = parseInt(await redis.get(RedisKey.otpRateKey(meta.email)) || '0',10);
    if(sendCount>= RATE_MAX){
        throw new TooManyRequestsError("Too many OTP requests. Try again later.",
            "OTP_RATE_LIMIT")
    }
    const otp = otpGenerator.generate(6,{
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
    })

    const otpSessionId = crypto.randomUUID();
    const hased = hmacFor(meta.email,otp);
    await redis.set(RedisKey.otp(otpSessionId),JSON.stringify({
        hasedOtp: hased,
        meta
    }),'EX',OTP_TTL);
    await redis.incr(RedisKey.otpRateKey(meta.email));
    await redis.expire(RedisKey.otpRateKey(meta.email),3600);
    return {otp,otpSessionId};
}

export const verifyOTPInner = async(otp,otpSessionId)=>{
    const rawData = await redis.get(RedisKey.otp(otpSessionId));
    if(!rawData) return null;

    const { hasedOtp: storeOTP,meta } = JSON.parse(rawData);
    const attemptsCount = parseInt(await redis.get(RedisKey.otpVerifyAttempts(meta.email)) || '0',10);
    if(attemptsCount>= ATTEMPT_MAX){
        throw new TooManyRequestsError('Too many attempts to verify OTP')
    }
    const hasedOtp = hmacFor(meta.email,otp);
    if(crypto.timingSafeEqual(
        Buffer.from(hasedOtp,'hex'),
        Buffer.from(storeOTP,'hex')
    )){
        await redis.del(RedisKey.otp(otpSessionId));
        await redis.del(RedisKey.otpRateKey(meta.email));
        return meta;
    }else{
        await redis.incr(RedisKey.otpVerifyAttempts(meta.email));
        await redis.expire(RedisKey.otpVerifyAttempts(meta.email),OTP_TTL);
        return null;
    }
}