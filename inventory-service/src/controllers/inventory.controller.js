import inventoryService from "../services/inventory.service.js";
import { BadRequestError } from "../utils/error.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getSchedule = asyncHandler(async(req,res)=>{
    const {scheduleId} = req.params;
    const scheduleData = await inventoryService.getSceduleService(scheduleId);
    res.status(200).json({
        success: true,
        data: scheduleData
    })
})

export const getScheduleSeats = asyncHandler(async(req,res)=>{
    const {scheduleId} = req.params;
    const {status, seatType, fromSeq,toSeq} = req.query;
    const filter = {};
    if(status) filter.status = status.toUpperCase();
    if(seatType) filter.seatType = seatType.toUpperCase();
    if(fromSeq) filter.fromSeq = fromSeq;
    if(toSeq) filter.toSeq = toSeq;

    const data = await inventoryService.getScheduleSeatsService(scheduleId,filter);
    res.status(200).json({
        success: true,
        data
    })
})

export const lockSeatsController = asyncHandler(async(req,res)=>{
    const {scheduleId,seatIds,userId,
                    ttlSec,
                    fromSeq,
                    toSeq} = req.body;

    if(!scheduleId || !seatIds || !Array.isArray(seatIds)  || !ttlSec || !fromSeq || !toSeq){
        throw new BadRequestError('The scheduleId, seatIds, ttlSec, fromSeq, toSeq are mandatory');
    }
    if(!userId){
        throw new BadRequestError('userId is required');
    }

    const result = await inventoryService.lockSeatsService(scheduleId,seatIds,userId,
                    ttlSec,
                    fromSeq,
                    toSeq);

    res.status(200).json({
        success: true,
        message: `${result.lockedSeats.length} seats locked succesfully`,
        data:{
            scheduleId: result.scheduleId,
            lockedSeats: result.lockedSeats,
            lockExpiresAt: result.lockExpiresAt
        }
    })
})

export const confirmedSeatsController = asyncHandler(async(req,res)=>{
    const { scheduleId, seatIds, userId, bookingId, fromSeq, toSeq } = req.body;

    if(!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0){
        throw new BadRequestError('scheduleId, seatIds (non-empty array), and bookingId are required');
    }
    if(!bookingId){
        throw new BadRequestError('bookingId is required');
    }
    if(!userId){
        throw new BadRequestError('userId is required');
    }

    const result = await inventoryService.confirmSeatsService(scheduleId, seatIds, userId, bookingId, fromSeq, toSeq);

    res.status(200).json({
        success: true,
        message: `${result.confirmedSeats.length} seats confirmed`,
        data: {
            scheduleId: result.scheduleId,
            bookingId: result.bookingId,
            confirmedSeats: result.confirmedSeats,
        },
    })
})

export const cancelBookingController = asyncHandler(async(req,res)=>{
    const {scheduleId,bookingId,userId} = req.body;
    if (!scheduleId || !bookingId){
        throw new BadRequestError('scheduleId and bookingId are required');
    }
    if(!userId){
        throw new BadRequestError('userId is required');
    }
    const result = await inventoryService.cancelBookingService(scheduleId,bookingId);
    res.status(200).json({
        success: true,
        message: `Booking cancelled, ${result.releasedSeats.length} seat(s) released`,
        data: {
            scheduleId: result.scheduleId,
            bookingId: result.bookingId,
            releasedSeats: result.releasedSeats,
        },
    });
})

export const unlockSeatsController = asyncHandler(async(req,res)=>{
    const {scheduleId,seatIds,userId,fromSeq,toSeq} = req.body;

    if(!scheduleId || !seatIds || !Array.isArray(seatIds) || !fromSeq || !toSeq){
        throw new BadRequestError('All feilds are required and non empty array are required');
    }
    if(!userId){
        throw new BadRequestError('userId is required');
    }

    const result = await inventoryService.unlockSeatsService(scheduleId,seatIds,userId,fromSeq,toSeq);
    res.status(200).json({
        success: true,
        message: `${result.unlockSeats.length} seats unlocked successfully`,
        data: {
               scheduleId: result.scheduleId,
               unlockedSeats: result.unlockedSeats,
          },
    });

});