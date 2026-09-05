import paymentService from "../services/payment.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";

export const razporPayWebhook = asyncHandler(async(req,res)=>{
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
        throw new BadRequestError("x-razorpay-signature header missing");
    }

    const rawBody = req.body;
    const result = await paymentService.handleWebhook(rawBody, signature);

    res.status(200).json({
        success: true,
        status: 'ok',
        data: result,
    });
})