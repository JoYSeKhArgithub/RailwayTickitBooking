import express from 'express';
import { createStation, getAllStations, getStationByIdHub, getStationByIdInterval } from '../controllers/station.controller.js';
import { adminAuth } from '../middlewares/adminAuth.middleware.js';

const router = express.Router();

router.use(adminAuth);

router.route("/station").post(createStation);
router.route("/station").get(getAllStations);
router.route("/station/:stationId").get(getStationByIdHub);
router.route("/station/internel/:stationId").get(getStationByIdInterval);
router.route("/station/internal/:stationId").get(getStationByIdInterval);

export default router;