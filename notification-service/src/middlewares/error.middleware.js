import { logger } from '../config/logger.js';
import { config } from '../config/root.js';

export const errorMiddleware = (err, req, res, next) => {
    logger.error('Unhandled server error in request pipeline', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    return res.status(err.statusCode || 500).json({
        success: false,
        error: err.code || 'SERVER_ERROR',
        message: config.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    });
};

export default errorMiddleware;
