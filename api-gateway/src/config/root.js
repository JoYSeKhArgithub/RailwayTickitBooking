import pkg from '../../package.json' with { type: 'json' };
export const config = {
    PORT: process.env.PORT || 4000,
    SERVICE_NAME: pkg.name,
    LOG_LEVEL: process.env.LOG_LEVEL,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
    REDIS_URL: process.env.REDIS_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "0f8bf908f8d38527c188c93bda49d48bd421a43fa0bdf3e77de1f0db785e6f37",
    INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY || 'Joy123987sekharBanerjeeRonyCheckHI',
    WAITING_ROOM_SECRET: process.env.WAITING_ROOM_SECRET || 'tatkal-waiting-room-secret-key-super-secure',
    SERVICE_TIMEOUT_MS: parseInt(process.env.SERVICE_TIMEOUT_MS || '60000', 10),

    CIRCUIT_BREAKER_THRESHOLD: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
    CIRCUIT_BREAKER_TIMEOUT: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000', 10),

    SERVICES: {
        USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:8080',
        ADMIN_SERVICE_URL: process.env.ADMIN_SERVICE_URL || 'http://localhost:6123',
        SEARCH_SERVICE_URL: process.env.SEARCH_SERVICE_URL || 'http://localhost:4002',
        INVENTORY_SERVICE_URL: process.env.INVENTORY_SERVICE_URL || 'http://localhost:4005',
        BOOKING_SERVICE_URL: process.env.BOOKING_SERVICE_URL || 'http://localhost:4008',
        PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4011',
    }
}

export const CircuitBreakerState = {
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN',
    CLOSED: 'CLOSED'
}