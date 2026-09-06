import { ForbiddenError } from '../utils/error.js';

export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError('Forbidden: Insufficient permissions'));
        }
        next();
    };
};
