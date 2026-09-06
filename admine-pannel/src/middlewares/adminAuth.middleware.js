import { config } from '../config/root.js';
import { ForbiddenError, UnauthorizedError } from '../utils/error.js';

export const adminAuth = (req, res, next) => {
    const serviceKey = req.headers['x-internal-service-key'];
    const expectedKey = config.INTERNAL_SERVICE_KEY ;

    if (!serviceKey || serviceKey !== expectedKey) {
        throw new ForbiddenError('Invalid or missing internal service key');
    }

    const isInternalLookup = req.path.includes('/internal/');
    if (isInternalLookup) {
        return next();
    }

    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    if (!userId) {
        throw new UnauthorizedError('User context is missing');
    }

    if (userRole !== 'ADMIN') {
        throw new ForbiddenError('Access forbidden: Admin role required');
    }

    req.user = { id: userId, role: userRole };
    next();
};
