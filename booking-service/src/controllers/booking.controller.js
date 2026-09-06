import bookingService from "../services/booking.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";

export const createBookingController = asyncHandler(async (req, res) => {
    const authenticatedUserId = req.user.id;
    const { scheduleId, seatIds, passengers, idempotencyKey, fromStationId, toStationId, fromSeq, toSeq } = req.body;
    if (!scheduleId || !seatIds || !passengers || !idempotencyKey || !fromStationId || !toStationId || !fromSeq || !toSeq) {
        throw new BadRequestError('The fields are not enough for booking check this again');
    }

    const bookingResult = await bookingService.createBooking(authenticatedUserId,scheduleId,seatIds,passengers,idempotencyKey,fromStationId,toStationId,fromSeq,toSeq);
    res.status(200).json({
        success: true,
        data: bookingResult,
    });
});

export const getBookingsController = asyncHandler(async (req, res) => {
    const authenticatedUserId = req.user.id;
    const { bookingId } = req.params;
    const bookingDetails = await bookingService.getBooking(bookingId, authenticatedUserId);
    res.status(200).json({
        success: true,
        data: bookingDetails,
    });
});

export const getUsersBooking = asyncHandler(async (req, res) => {
    const authenticatedUserId = req.user.id;
    const { status, page, limit } = req.query;
    const userBookingsResult = await bookingService.getUserBookings(authenticatedUserId, {
        status,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
    });
    res.status(200).json({
        success: true,
        data: userBookingsResult,
    });
});

export const cancelBookingController = asyncHandler(async (req, res) => {
    const authenticatedUserId = req.user.id;
    const { bookingId } = req.params;
    const cancellationResult = await bookingService.cancelBooking(bookingId, authenticatedUserId);
    res.status(200).json({
        success: true,
        data: cancellationResult,
    });
});

export const verifyPaymentController = asyncHandler(async (req, res) => {
    const authenticatedUserId = req.user.id;
    const { bookingId } = req.params;
    const { razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayPaymentId || !razorpaySignature) {
        throw new BadRequestError('razorpayPaymentId and razorpaySignature are required');
    }

    const paymentVerificationResult = await bookingService.verifyPayment(
        bookingId,
        authenticatedUserId,
        razorpayPaymentId,
        razorpaySignature
    );
    res.status(200).json({
        success: true,
        data: paymentVerificationResult,
    });
});