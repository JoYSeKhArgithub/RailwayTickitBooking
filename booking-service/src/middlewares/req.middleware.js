import { logger } from '../config/logger.js';

export const reqLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(
            `[${req.method}] ${req.originalUrl} - status: ${res.statusCode} - ${duration}ms`
        );
    });
    next();
};

export const reqMiddleware = reqLogger;
export default reqLogger;
