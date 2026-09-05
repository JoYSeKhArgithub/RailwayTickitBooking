import cors from 'cors';
import { config } from '../config/root.js';

const allowedOrigins = config.ALLOWED_ORIGINS === 'ALL' || config.ALLOWED_ORIGINS === '*'
    ? '*'
    : config.ALLOWED_ORIGINS
        ? config.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [];

export const corsMiddleWare = cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins === '*' || (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-service-key', 'x-razorpay-signature'],
});
