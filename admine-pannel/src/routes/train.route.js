import express from 'express';
import { createRouteController, createTrainController, getAllTrainController, getTrainByIdControler } from '../controllers/train.controller.js';

const route =  express.Router();

route.route("/train").post(createTrainController);
route.route("/route").post(createRouteController);
route.route("/train").get(getAllTrainController);
route.route("/train/:trainId").get(getTrainByIdControler);

export default route;