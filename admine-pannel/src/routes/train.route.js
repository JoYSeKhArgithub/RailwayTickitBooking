import express from 'express';
import { createRouteController, createTrainController, getAllTrainController, getTrainByIdControler } from '../controllers/train.controller.js';
import { adminAuth } from '../middlewares/adminAuth.middleware.js';

const route = express.Router();

route.use(adminAuth);

route.route("/train").post(createTrainController);
route.route("/route").post(createRouteController);
route.route("/train").get(getAllTrainController);
route.route("/train/:trainId").get(getTrainByIdControler);

export default route;