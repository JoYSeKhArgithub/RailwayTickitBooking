import inventoryService from "../services/inventory.service";

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