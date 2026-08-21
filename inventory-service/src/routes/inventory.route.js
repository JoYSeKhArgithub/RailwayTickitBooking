import express from 'express';
import { getSchedule, getScheduleSeats, lockSeatsController, unlockSeatsController } from '../controllers/inventory.controller.js';
const router = express.Router();

router.route('/schedules/:scheduleId/availability').get(getSchedule);
router.route('/schedules/:scheduleId/seats').get(getScheduleSeats);
router.route('/seats/lock').post(lockSeatsController);
router.route('/seats/unlock').post(unlockSeatsController);
export default router;