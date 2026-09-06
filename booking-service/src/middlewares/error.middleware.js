import { logger } from '../config/logger.js';
import { config } from '../config/root.js';
import { AppError } from '../utils/error.js';

export const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.code,
            message: err.message,
        });
    }

    if (config.NODE_ENV !== 'production') {
        logger.error({
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            body: req.body,
        });
    } else {
        logger.error(`Unhandled error: ${err.message}`);
    }

    return res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: err.message || 'Internal Server Error',
    });
};

export const errorMiddleware = errorHandler;
export default errorHandler;
