import bookingService from "../services/booking.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";

export const createBookingController = asyncHandler(async(req,res)=>{
    const userId = req.user.id;
    const { scheduleId, seatIds, passengers, idempotencyKey, fromStationId, toStationId, fromSeq, toSeq } = req.body;
    if (!scheduleId || !seatIds || !passengers || !idempotencyKey || !fromStationId || !toStationId || !fromSeq || !toSeq){
        throw new BadRequestError('The fileds are not enough for bookig check this again');
    }

    const result = await bookingService.createBookingService(userId, scheduleId, seatIds, passengers, idempotencyKey, fromStationId, toStationId, fromSeq, toSeq);
    res.status(200).json({
        success: true,
        data: result
    })
})