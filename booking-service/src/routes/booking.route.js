import express from 'express';
import {
    createBookingController,
    getBookingsController,
    getUsersBooking,
    cancelBookingController,
    verifyPaymentController,
} from '../controllers/booking.controller.js';
import { authorizeMiddleware } from '../middlewares/authorize.middleware.js';

const router = express.Router();

router.post('/bookings', authorizeMiddleware, createBookingController);
router.get('/bookings/:bookingId', authorizeMiddleware, getBookingsController);
router.get('/bookings', authorizeMiddleware, getUsersBooking);
router.post('/bookings/:bookingId/cancel', authorizeMiddleware, cancelBookingController);
router.post('/bookings/:bookingId/verify-payment', authorizeMiddleware, verifyPaymentController);

router.post('/', authorizeMiddleware, createBookingController);
router.get('/:bookingId', authorizeMiddleware, getBookingsController);
router.post('/:bookingId/cancel', authorizeMiddleware, cancelBookingController);
router.post('/:bookingId/verify-payment', authorizeMiddleware, verifyPaymentController);

export const bookingRoutes = router;
export default router;

