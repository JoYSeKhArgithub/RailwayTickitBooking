import { config } from '../config/root.js';
import { ForbiddenError } from '../utils/error.js';

export const internalAuth = (req, res, next) => {
    const serviceKey = req.headers['x-internal-service-key'];
    const expectedKey = config.INTERNAL_SERVICE_KEY || 'Joy123987sekharBanerjeeRonyCheckHI';

    if (!serviceKey || serviceKey !== expectedKey) {
        throw new ForbiddenError('Invalid or missing internal service key');
    }
    next();
};
