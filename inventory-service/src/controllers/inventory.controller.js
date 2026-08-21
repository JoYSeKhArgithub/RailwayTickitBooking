import inventoryService from "../services/inventory.service";
import { BadRequest } from "../utils/error";

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

export const lockSeatsController = asyncHnadler(async(req,res)=>{
    const {scheduleId,seatIds,userId,
                    ttlSec,
                    fromSeq,
                    toSeq} = req.body;

    if(!scheduleId || !seatIds || !Array.isArray(seatIds)  || !ttlSec || !fromSeq || !toSeq){
        throw new BadRequest('The scheuleId ,seatIds , ttlsec , fromSeq, toSeq are mandetory');
    }
    if(!userId){
        throw new BadRequest('userId is required');
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