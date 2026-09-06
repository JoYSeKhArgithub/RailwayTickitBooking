import 'dotenv/config'
import pkg from '../../package.json' with {type: 'json'};

export const config = {
    PORT: Number(process.env.PORT)||4011,
    SERVICE_NAME: pkg.name,
    NODE_ENV: process.env.NODE_ENV || 'DEVELOPMENT',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    DATABASE_URL: process.env.DATABASE_URL,
    ALLOWED_ORIGINS: process.env.ALLOW_ORIGIN || '*',
    INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY || 'Joy123987sekharBanerjeeRonyCheckHI',
    PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || 'razorpay',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    KAFKA_BROKERS: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'payment-service'
}