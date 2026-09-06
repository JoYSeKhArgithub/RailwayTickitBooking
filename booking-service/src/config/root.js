import 'dotenv/config'
import pkg from '../../package.json' with { type: 'json' };
export const config = {
    PORT: Number(process.env.PORT) || 4008,
    SERVICE_NAME: pkg.name,
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    INVENTORY_SERVICE_URL: process.env.INVENTORY_SERVICE_URL || 'http://localhost:4005',
    PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4011',
    USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:8080',
    ADMIN_SERVICE_URL: process.env.ADMIN_SERVICE_URL || 'http://localhost:6123',
    INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY,
    REDIS_URL: process.env.REDIS_URL || 'redis://:irctcyoj@localhost:6379',
    KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9093',
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'booking-service',
    BOOKING_TTL_SECONDS: parseInt(process.env.BOOKING_TTL_SECONDS || '600',10),
    LOCK_TTL_SECONDS: parseInt(process.env.LOCK_TTL_SECONDS || '600',10),
    BOOKING_EXPIRY_CHECK_INTERVAL_MS: parseInt(process.env.BOOKING_EXPIRY_CHECK_INTERVAL_MS || '30000', 10),
}