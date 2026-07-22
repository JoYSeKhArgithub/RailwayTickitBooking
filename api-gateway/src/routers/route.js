import express from 'express';
import { createProxy } from '../services/proxy.service.js';
import { config } from '../config/root.js';
import { combinedRateLimit, endpointRateLimit } from '../middlewares/rateLimiting.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

const userServiceProxy = createProxy('userService',config.SERVICES.USER_SERVICE_URL);



router.route('/users/auth/send-otp').post(
    endpointRateLimit('otpSend', (req) => req.body.email || req.ip),
    userServiceProxy
);

router.route('/users/auth/verify-otp').post(
    endpointRateLimit('otpVerify', (req) => req.body.email || req.ip),
    userServiceProxy
);

router.route('/users/auth/login').post(
    endpointRateLimit('login', (req) => req.body.email || req.ip),
    userServiceProxy
);

router.route('/users/auth/google-auth').post(
    endpointRateLimit('googleAuth', (req) => req.body.email || req.ip),
    userServiceProxy
);

router.route('/users/auth/refresh').post(
    endpointRateLimit('tokenRefresh', (req) => req.ip),
    userServiceProxy
);

router.route('/users/user/profile').get(
    authMiddleware,
    combinedRateLimit(),
    userServiceProxy
)

export default router;