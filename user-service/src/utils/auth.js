import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/root.js';

export const hasToken = (refreshToken)=>{
    return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

export const generateAccessToken = (userId, role = 'USER') => {
    const payload = {
        id: userId,
        role: role
    };
    return jwt.sign(payload, config.JWT_ACCESS_SECRET, { expiresIn: config.ACCESS_TOKEN_EXP });
};

export const generateRefreshToken = (userId)=>{
    const payload = {
        id: userId,
        jti: crypto.randomUUID()
    }

    return jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: config.REFRESH_TOKEN_EXP })
}

export const verifyAccessToken = (accessToken)=>{
    return jwt.verify(accessToken,config.JWT_ACCESS_SECRET)
}

export const verifyRefreshToken = (refreshToken)=>{
    return jwt.verify(refreshToken,config.JWT_REFRESH_SECRET);
}