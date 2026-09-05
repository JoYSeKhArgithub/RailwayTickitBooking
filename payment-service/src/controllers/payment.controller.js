import paymentService from "../services/payment.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";

export const createPaymentOrderController = asyncHandler(async (req, res) => {
    const { bookingId, userId, amount, idempotencyKey } = req.body;
    if (!bookingId || !userId || !amount || !idempotencyKey) {
        throw new BadRequestError("bookingId, userId, amount, and idempotencyKey are required");
    }

    const result = await paymentService.createPaymentOrder(bookingId, amount, userId, idempotencyKey);
    res.status(201).json({
        success: true,
        data: result,
    });
});

export const verifyPaymentController = asyncHandler(async (req, res) => {
    const { paymentOrderId } = req.params;
    const { gatewayPaymentId, gatewaySignature } = req.body;

    if (!paymentOrderId || !gatewayPaymentId || !gatewaySignature) {
        throw new BadRequestError("paymentOrderId, gatewayPaymentId, and gatewaySignature are required");
    }

    const result = await paymentService.verifyAndCapturePayment(paymentOrderId, gatewayPaymentId, gatewaySignature);
    res.status(200).json({
        success: true,
        data: result,
    });
});

export const initiateRefundController = asyncHandler(async (req, res) => {
    const { paymentOrderId, amount, reason, idempotencyKey } = req.body;

    if (!paymentOrderId || !amount || !idempotencyKey) {
        throw new BadRequestError("paymentOrderId, amount, and idempotencyKey are required");
    }

    const result = await paymentService.initiateRefund(paymentOrderId, amount, reason, idempotencyKey);
    res.status(200).json({
        success: true,
        data: result,
    });
});

export const getPaymentOrderController = asyncHandler(async (req, res) => {
    const { paymentOrderId } = req.params;

    if (!paymentOrderId) {
        throw new BadRequestError("paymentOrderId is required");
    }

    const result = await paymentService.getPaymentOrder(paymentOrderId);
    res.status(200).json({
        success: true,
        data: result,
    });
});



export default {
    createPaymentOrderController,
    verifyPaymentController,
    initiateRefundController,
    getPaymentOrderController,
};