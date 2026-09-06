import svgCaptcha from 'svg-captcha'
import {v4 as uuid4} from 'uuid';
import {redis} from '../config/Redis/redis.js';
import { RedisKey } from '../config/Redis/key.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../utils/error.js';
import { prisma } from '../config/prisma.js';
import bcrypt from 'bcrypt';
import { config } from '../config/root.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/auth.js';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';
import { generateAndStoreOTP, verifyOTPInner } from '../utils/otp.js';
import notificationProducer from '../kafka/producer/notification.producer.js';

const generateCaptcha = async()=>{
    const captcha = svgCaptcha.create({ size: 6, noise: 3, color: true, background: '#f5f5f5'});
    const captchaId = uuid4();
    await redis.set(RedisKey.captchaId(captchaId),captcha.text.toLowerCase(),'EX',2000);

    const responsePayload = { captchaId, captchaImage: captcha.data };
    if (process.env.NODE_ENV !== 'PRODUCTION') {
        responsePayload.captchaText = captcha.text;
        logger.info(`[CAPTCHA GENERATED] ID: ${captchaId} | Text: ${captcha.text}`);
    }
    return {captchaId,captchaImage:captcha.data}
}

const sendOTP = async(registerPayload)=>{
    const { firstName, lastName, email, password, mobile, dob, gender, captchaId, captchaValue }= registerPayload;
    const cachedCaptcha = await redis.get(RedisKey.captchaId(captchaId));
    logger.info(`The error on invalidation is ${cachedCaptcha}`)
    if(!cachedCaptcha || cachedCaptcha !== captchaValue.toLowerCase() ){
        throw new BadRequestError('Invalid or expire captcha code')
    }
    await redis.del(RedisKey.captchaId(captchaId));
    const existingUser = await prisma.user.findUnique({
        where: {email}
    })

    if(existingUser){
        throw new ConflictError("A registraction profile matching this email address already exists");
    }

    const hashedPassword = await bcrypt.hash(password,12);
    const transientUser = { firstName, lastName, email, mobile, dob, gender, hashedPassword };

    const { otp, otpSessionId } = await generateAndStoreOTP(transientUser);
    logger.info(`The otp for ${email} is ${otp}`);

    await notificationProducer.sendOtpEmail(email, otp, Math.round((config.OTP_TTL || 300) / 60));
    logger.info(`OTP email queued for : ${email}`);

    return {otpSessionId}
}

const verifyOtp = async(otp,otpSessionId)=>{

    const meta = await verifyOTPInner(otp,otpSessionId);
    if (meta === null) {
        throw new BadRequestError("Invalid or expired OTP", "OTP_INVALID");
    }
    logger.info(`The first name : ${meta.firstName} and ${meta}`)
    const user = await prisma.user.create({
        data: {
            firstName: meta.firstName,
            lastName: meta.lastName,
            email: meta.email,
            mobile: meta.mobile || null,
            dob: meta.dob? new Date(meta.dob): null,
            gender: meta.gender || null,
            password: meta.hashedPassword,
            emailVerified: true
        }
    })

    const {password: _,...safeValue} = user;

    await notificationProducer.sendWelcomeEmail(meta.email, meta.firstName);
    logger.info(`Welcome email queued for ${meta.email}`);

    return {safeValue};
}

const login = async(email,password,deviceId,ipAddress)=>{
    const existingUser = await prisma.user.findUnique({where: {email}});
    if(!existingUser){
        throw new UnauthorizedError("Invalid email account configuration or password entry","INVALID_CREDENTIALS")
    }
    if(!existingUser.password){
        throw new BadRequestError("Account identity provisioned via Google Federated OAuth. Please verify via Google.", "OAUTH_ONLY_ACCOUNT")
    }
    const doesPasswordMatch = await bcrypt.compare(password,existingUser.password);
    if(!doesPasswordMatch){
        throw new UnauthorizedError("Invalid email account configuration or password entry", "INVALID_CREDENTIALS")
    }

    const accessToken = generateAccessToken(existingUser.id);
    const refreshToken = generateRefreshToken(existingUser.id);

    const {jti,exp} = jwt.decode(refreshToken);

    await prisma.session.deleteMany({
        where: {
            userId: existingUser.id
        }
    })

    await prisma.session.create({
        data:{
            userId: existingUser.id,
            refreshToken: refreshToken,
            deviceInfo: deviceId,
            ipAddress: ipAddress,
            expiresAt: new Date(exp * 1000)
        }
    })

    await redis.set(RedisKey.refreshToken(existingUser.id),jti,'EX',config.REFRESH_TOKEN_EXP_SEC);
    const {password: _password,...safeUser} = existingUser;
    await redis.set(RedisKey.loginUser(existingUser.id),JSON.stringify(safeUser),'EX',config.REDIS_USER_TTL);

    return {accessToken,refreshToken,loginUser: safeUser}
}


const rotateRefreshToken = async(refreshToken,deviceId,ipAddress)=>{
    const payload = verifyRefreshToken(refreshToken);

    const {id:userId,jti} = payload;
    const activeDbSession = await prisma.session.findUnique({where: {refreshToken}});
    if(!activeDbSession){
        await prisma.session.deleteMany({where: {userId}})
        await redis.del(RedisKey.refreshTokenDeviceIdUserId(deviceId,userId))
        await redis.del(RedisKey.loginUser(userId))
        throw new ForbiddenError("Security violation detected. Compromised session invalidated.", "LOGIN_AGAIN");
    }
    const storeJti = await redis.get(RedisKey.refreshTokenDeviceIdUserId(deviceId,userId));
    if(storeJti && storeJti!== jti){
        await prisma.session.deleteMany({where: {userId}})
        await redis.del(RedisKey.refreshTokenDeviceIdUserId(deviceId,userId))
        throw new ForbiddenError("Token state duplication triggered anomaly protections.", "LOGIN_AGAIN");
    }

    const newAccessToken = generateAccessToken(userId);
    const newRefreshToken = generateRefreshToken(userId);
    const { jti: newJti, exp: newExp } = jwt.decode(newRefreshToken);

    await prisma.session.update({
        where: {id: activeDbSession.id},
        data:{
            refreshToken: newRefreshToken,
            ipAddress: ipAddress,
            expiresAt: new Date(newExp*1000)
        }
    })
    await redis.set(RedisKey.refreshTokenDeviceIdUserId(deviceId,userId),newJti,'EX',config.REFRESH_TOKEN_EXP_SEC);
    return {newAccessToken,newRefreshToken}
}

const verifyGoogleIdToken = async()=>{

}


export {
    generateCaptcha,
    sendOTP,
    verifyOtp,
    login,
    rotateRefreshToken,
    verifyGoogleIdToken,
};

export default {
    generateCaptcha,
    sendOTP,
    verifyOtp,
    login,
    rotateRefreshToken,
    verifyGoogleIdToken,
};