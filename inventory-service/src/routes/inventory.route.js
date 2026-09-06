import express from 'express';
import {
    cancelBookingController,
    getSchedule,
    getScheduleSeats,
    lockSeatsController,
    confirmedSeatsController,
    unlockSeatsController
} from '../controllers/inventory.controller.js';
const router = express.Router();

router.route('/schedules/:scheduleId/availability').get(getSchedule);
router.route('/schedules/:scheduleId/seats').get(getScheduleSeats);
router.route('/seats/lock').post(lockSeatsController);
router.route('/seats/unlock').post(unlockSeatsController);
router.route('/seats/confirm').post(confirmedSeatsController);
router.route('/seats/cancel-booking').post(cancelBookingController)
export default router;