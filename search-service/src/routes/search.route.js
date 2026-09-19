import express from 'express';
import { AllStationController, AllTrainController, AutoComplteStationConstroller, searchController } from '../controllers/search.controller.js';

const router = express.Router();

router.route('/trains').get(searchController);
router.route('/autocomplete').get(AutoComplteStationConstroller);
router.route('/getStations').get(AllStationController);
router.route('/getTrains').get(AllTrainController);

export default router;