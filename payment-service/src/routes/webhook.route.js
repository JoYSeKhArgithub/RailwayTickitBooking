import express from "express";
import { razporPayWebhook } from "../controllers/webhook.controller.js";

const router = express.Router();

router.post('/webhook/razorpay', express.raw({ type: 'application/json' }), razporPayWebhook);
export default router;