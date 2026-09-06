import cors from 'cors';
import { config } from "../config/root.js";

const allowedOrigins = config.ALLOWED_ORIGINS
    ? config.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

export const corsMiddleware = cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        if (config.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }

        callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-idempotency-key',
        'x-razorpay-signature',
        'x-user-id',
        'x-internal-service-key',
        'Accept',
        'Origin',
        'X-Requested-With'
    ],
    exposedHeaders: [
        'X-RateLimiting-Limit',
        'X-RateLimit-Remaining',
        'Retry-After'
    ],
    maxAge: 86400, 
});
