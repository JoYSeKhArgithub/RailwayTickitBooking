import winston from 'winston';
import { config } from './root.js';

export const logger = winston.createLogger({
    level:config.LOG_LEVEL,
    defaultMeta: {service: config.SERVICE_NAME},
    formate: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({level,message,timestamp,service})=>{
            return `[${timestamp}] [${level}] [${service}]: [${message}]`
        })
    ),
    transport: [new winston.transports.Console()]
})

