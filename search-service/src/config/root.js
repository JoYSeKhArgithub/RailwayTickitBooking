import 'dotenv/config'
import pkg from '../../package.json' with { type: 'json' };
export const config = {
    PORT: Number(process.env.PORT) || 4002,
    SERVICE_NAME: pkg.name,
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    KAFKA_BROKER: process.env.KAFKA_BROKER,
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    ELASTIC_SEARCH_URL: process.env.ELASTICSEARCH_URL
    // INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY,
}