import { asyncHandler } from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";
import scheduleService from "../services/schedule.service.js";

export const createScheduleController = asyncHandler(async(req,res)=>{
    const { trainId, departureDate } = req.body;
    if(!trainId || !departureDate){
        throw new BadRequestError("TarinId and DepartureDate is require for create schedule");
    }
    const schedule = await scheduleService.createSchedule({ trainId, departureDate });
    return res.status(201).json({
        success: true,
        message: "Train schedule created successfully",
        data: schedule
    })
});

export const getAllScheduleController = asyncHandler(async(req,res)=>{
    const schedules = await scheduleService.getAllSchedules(req.query);
    return res.status(200).json({
        success: true,
        message: "Find all schedule train successfully",
        data: schedules
    })
})

export const cancelScheduleController = asyncHandler(async(req,res)=>{
    const {scheduleId} = req.params;
    if(!scheduleId){
        throw new BadRequestError("ScheduleId is missing")
    }

    const schedule = await scheduleService.cancelSchedule(scheduleId);
    return res.status(200).json({
        success: true,
        message: "Schedule Cancelled",
        data: schedule
    })
})