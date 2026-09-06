import { config } from "../config/root.js";
import { ForbiddenError, UnauthorizedError } from "../utils/error.js";

export const authorizeMiddleware = (req, res, next) => {
    const serviceKey = req.headers['x-internal-service-key'];
    if (!serviceKey || serviceKey !== config.INTERNAL_SERVICE_KEY) {
        return next(new ForbiddenError('Invalid or missing internal service key'));
    }

    const userId = req.headers['x-user-id'];
    if (!userId) {
        return next(new UnauthorizedError('Cannot found the user Id for booking'));
    }

    req.user = {
        id: userId,
        role: req.headers['x-user-role'] || 'USER'
    };
    next();
};