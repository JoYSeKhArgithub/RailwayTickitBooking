import express from 'express';
import { createProxy, getCircuitBreakerStatus } from '../services/proxy.service.js';
import { config } from '../config/root.js';
import { combinedRateLimit, endpointRateLimit } from '../middlewares/rateLimiting.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { waitingRoomMiddleware, checkAdmissionStatus } from '../middlewares/waitingRoom.middleware.js';

const router = express.Router();


const userServiceProxy = createProxy('userService', config.SERVICES.USER_SERVICE_URL, { stripPrefix: true });
const adminServiceProxy = createProxy('adminService', config.SERVICES.ADMIN_SERVICE_URL, { stripPrefix: true });
const searchServiceProxy = createProxy('searchService', config.SERVICES.SEARCH_SERVICE_URL, { stripPrefix: true });
const inventoryServiceProxy = createProxy('inventoryService', config.SERVICES.INVENTORY_SERVICE_URL, { stripPrefix: true });
const bookingServiceProxy = createProxy('bookingService', config.SERVICES.BOOKING_SERVICE_URL, { stripPrefix: false });
const paymentServiceProxy = createProxy('paymentService', config.SERVICES.PAYMENT_SERVICE_URL, { stripPrefix: true });

router.get('/gateway/circuit-breakers', (req, res) => {
    res.status(200).json({
        success: true,
        data: getCircuitBreakerStatus(),
    });
});


router.route('/users/auth/captcha').get(
    endpointRateLimit('captcha', (req) => req.ip),
    userServiceProxy
);

router.route('/users/auth/signup').post(
    endpointRateLimit('signup', (req) => req.body?.email || req.ip),
    userServiceProxy
);

router.route('/users/auth/send-otp').post(
    endpointRateLimit('otpSend', (req) => req.body?.email || req.ip),
    userServiceProxy
);

router.route('/users/auth/verify-otp').post(
    endpointRateLimit('otpVerify', (req) => req.body?.email || req.ip),
    userServiceProxy
);

router.route('/users/auth/verifyotp').post(
    endpointRateLimit('otpVerify', (req) => req.body?.email || req.ip),
    userServiceProxy
);

router.route('/users/auth/login').post(
    endpointRateLimit('login', (req) => req.body?.email || req.ip),
    userServiceProxy
);

router.route('/users/auth/google-auth').post(
    endpointRateLimit('googleAuth', (req) => req.body?.email || req.ip),
    userServiceProxy
);

router.route('/users/auth/refresh').post(
    endpointRateLimit('tokenRefresh', (req) => req.ip),
    userServiceProxy
);

router.route('/users/auth/rotatedRefreshToken').post(
    endpointRateLimit('tokenRefresh', (req) => req.ip),
    userServiceProxy
);


router.route('/users/user/profile').get(
    authMiddleware,
    combinedRateLimit(),
    userServiceProxy
);

router.route('/users/user/get-profile').get(
    authMiddleware,
    combinedRateLimit(),
    userServiceProxy
);

router.use('/users', userServiceProxy);


router.use('/search', combinedRateLimit(), searchServiceProxy);


router.use('/admin', adminServiceProxy);


router.use('/inventory', inventoryServiceProxy);

// Virtual Waiting Room status polling endpoint (must be declared BEFORE the gated /bookings proxy)
router.get('/bookings/queue/status', authMiddleware, checkAdmissionStatus);

router.use(
    '/bookings',
    authMiddleware,
    waitingRoomMiddleware({ queueName: 'booking' }),
    combinedRateLimit({
        endpointTier: 'bookingSubmit',
        endpointKeyFn: (req) => req.user?.id || req.ip,
    }),
    bookingServiceProxy
);

router.post('/payments/webhook/razorpay', paymentServiceProxy);

router.use('/payments', paymentServiceProxy);

export default router;