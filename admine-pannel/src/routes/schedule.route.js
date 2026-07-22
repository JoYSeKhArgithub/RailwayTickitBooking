import express, { Router } from 'express';
import { cancelScheduleController, createScheduleController, getAllScheduleController } from '../controllers/schedule.controller.js';

const router = Router();

router.route("/schedule").post( createScheduleController);
router.route("/schedule/:scheduleId").put(cancelScheduleController);
router.route("/schedule").post(getAllScheduleController);

export default router;