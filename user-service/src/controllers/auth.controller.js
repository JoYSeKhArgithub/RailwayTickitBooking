import { asyncHandler } from "../utils/asyncHandler.js";
import authService from '../services/auth.service.js'
import { BadRequestError, UnauthorizedError } from "../utils/error.js";
import { config } from "../config/root.js";
import { getDeviceFingerPrint } from "../utils/deviceFingerPrint.js";
const isProduction = process.env.NODE_ENV === 'PRODUCTION';

const cookieOptions = (maxAge)=>({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction? 'strict': 'lax',
    maxAge
})

export const getCapTcha = asyncHandler(async(req,res)=>{
    const captchaData = await authService.generateCaptcha();
    return res.status(200).json({
        sucess: true,
        data: captchaData
    })
})

export const register = asyncHandler(async(req,res)=>{
    const { firstName, lastName, email, password, confirmPassword, mobile, dob, gender, captchaId, captchaValue } = req.body;
    if (!firstName || !lastName || !email || !password || !confirmPassword || !mobile || !dob || !gender || !captchaId || !captchaValue){
        throw new BadRequestError("All standard registration and CAPTCHA fields are mandatory");
    }
    if (password !== confirmPassword){
        throw new BadRequestError("check the confirmpassword before processds")
    }
    const {otpSessionId} = await authService.sendOTP({
        firstName, lastName, email, password, mobile, dob, gender, captchaId, captchaValue
    })

    return res.cookie("otp_session", otpSessionId, cookieOptions(config.OTP_TTL * 1000)).status(200).json({
        success: true,
        message: "CAPTCHA validated successfully.Registration OTP sent to your email address."
    })
})

export const verifyOTP = asyncHandler(async(req,res)=>{
    const {otp} = req.body;
    const otpSessionId = req.cookies.otp_session;

    if(!otp || !otpSessionId){
        throw new BadRequestError("Required OTP componenets or session state token are missing");
    }

    const user = await authService.verifyOtp(otp,otpSessionId);

    res.clearCookie("otp_session");

    return res.status(201).json({
        sucess: true,
        message: "User account created and verified successfully",
        data: user
    })
})

export const login = asyncHandler(async(req,res)=>{
    const {email,password} = req.body;
    if(!email|| !password){
        throw new BadRequestError("Email and password are required");
    }
    const deviceId = getDeviceFingerPrint(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const {accessToken,refreshToken,loginUser} = await authService.login(email,password,deviceId,ipAddress);
    res.cookie('accessToken',accessToken,cookieOptions(config.ACCESS_TOKEN_EXP_SEC*1000));
    res.cookie('refreshToken',refreshToken,cookieOptions(config.REFRESH_TOKEN_EXP_SEC*1000));

    return res.status(200).json({
        success: true,
        message: "Sign-in verification approved",
        loginUser
    })
})

export const rotatedRefreshToken = asyncHandler(async(req,res)=>{
    const refreshToken = req.cookies.refreshToken;
    if(!refreshToken){
        throw new UnauthorizedError("Refresh token missing or session expired", "LOGIN_AGAIN");
    }
    const deviceId = getDeviceFingerPrint(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    const {newAccessToken,newRefreshToken} = await authService.rotateRefreshToken(refreshToken,deviceId,ipAddress);
    res.cookie("accessToken",newAccessToken,cookieOptions(config.ACCESS_TOKEN_EXP_SEC*1000))
    res.cookie("refreshToken",newRefreshToken,cookieOptions(config.REFRESH_TOKEN_EXP_SEC*1000))

    return res.status(200).json({
        sucess: true,
        message: "Tokens successfully roated and reused"
    })
})