import { Router } from "express";
import {
    createPaymentOrderController,
    verifyPaymentController,
    initiateRefundController,
    getPaymentOrderController,
} from "../controllers/payment.controller.js";

const router = Router();

router.post("/orders", createPaymentOrderController);

router.get("/orders/:paymentOrderId", getPaymentOrderController);
router.get("/order/:paymentOrderId", getPaymentOrderController);

router.post("/orders/:paymentOrderId/verify", verifyPaymentController);
router.post("/order/:paymentOrderId/verify", verifyPaymentController);

router.post("/refunds", initiateRefundController);


export default router;
