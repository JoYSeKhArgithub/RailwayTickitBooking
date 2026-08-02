import { logger } from "../config/logger.js"

export const reqMiddleware = (req,res,next)=>{
    logger.debug(`[${req.method}] ${req.originalUrl}`);
    const start = Date.now();
    req.on('finish',()=>{
        const duration = Date.now()-start;
        logger.info(
            `[${req.method}] ${req.originalUrl} - status: ${res.statusCode} - ${duration}ms`
        );
    });
    next();
}