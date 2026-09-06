import express from 'express';
import {
    cancelBookingController,
    getSchedule,
    getScheduleSeats,
    lockSeatsController,
    confirmedSeatsController,
    unlockSeatsController
} from '../controllers/inventory.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.route('/schedules/:scheduleId/availability').get(getSchedule);
router.route('/schedules/:scheduleId/seats').get(authMiddleware,getScheduleSeats);
router.route('/seats/lock').post(authMiddleware, lockSeatsController);
router.route('/seats/unlock').post(authMiddleware, unlockSeatsController);
router.route('/seats/confirm').post(authMiddleware, confirmedSeatsController);
router.route('/seats/cancel-booking').post(authMiddleware, cancelBookingController);

export default router;