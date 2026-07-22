export const RedisKey = {
    captchaId: (captchaId)=> `captcha:${captchaId}`,
    register: (otpSessionId)=> `register:${otpSessionId}`,
    otp: (otpSessionId)=> `otp:session:${otpSessionId}`,
    refreshToken: (id)=> `refresh:${id}`,
    loginUser: (id)=> `user:${id}`,
    refreshTokenDeviceIdUserId: (deviceId,userId)=>`refresh:${userId}:${deviceId}`,
    otpRateKey: (email)=> `otp:rate:${email}`,
    otpVerifyAttempts: (email)=>`otp:attempts:${email}`,
    user: (id)=>`user:${id}`
}