import express from 'express';
import { AllStationController, AllTrainController, AutoComplteStationConstroller, searchController } from '../controllers/search.controller';

const router = express.Router();

router.route('/trains').get(searchController);
router.route('/serch-auto').get(AutoComplteStationConstroller);
router.route('/getStations').get(AllStationController);
router.route('/getTrains').get(AllTrainController);

export default router;