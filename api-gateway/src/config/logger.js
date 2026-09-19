import winston from "winston";
import { config } from "./root.js";


export const logger = winston.createLogger({
    level: config.LOG_LEVEL || 'info',
    defaultMeta: { service: config.SERVICE_NAME },
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, service }) => {
            return `[${timestamp}] [${level}] [${service}]: ${message}`;
        })
    ),
    transports: [new winston.transports.Console()]
})