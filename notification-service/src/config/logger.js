import winston from 'winston';
import { config } from './root.js';

export const logger = winston.createLogger({
    level: config.LOG_LEVEL || 'info',
    defaultMeta: { service: config.SERVICE_NAME },
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.printf(({ level, message, timestamp, service, stack, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] [${level.toUpperCase()}] [${service}]: ${stack || message}${metaStr}`;
        })
    ),
    transports: [new winston.transports.Console()],
});

export default logger;
