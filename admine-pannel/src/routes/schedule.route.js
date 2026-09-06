import express, { Router } from 'express';
import { cancelScheduleController, createScheduleController, getAllScheduleController } from '../controllers/schedule.controller.js';
import { adminAuth } from '../middlewares/adminAuth.middleware.js';

const router = Router();

router.use(adminAuth);

router.route("/schedule").post(createScheduleController);
router.route("/schedule/:scheduleId").put(cancelScheduleController);
router.route("/schedule").get(getAllScheduleController);

export default router;