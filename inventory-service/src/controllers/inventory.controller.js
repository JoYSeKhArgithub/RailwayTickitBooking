import inventoryService from "../services/inventory.service";

export const getSchedule = asyncHandler(async(req,res)=>{
    const {scheduleId} = req.body;
    const scheduleData = await inventoryService.getSceduleService(scheduleId);
    res.status(200).json({
        success: true,
        data: scheduleData
    })
})