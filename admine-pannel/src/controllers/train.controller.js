import { asyncHandler } from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";
import trainService from "../services/train.service.js";

export const createTrainController = asyncHandler(async(req,res)=>{
    const {trainName,trainNumber,coachName,seats} = req.body;
    
    if(!trainName || !trainNumber || !coachName || !seats){
        throw new BadRequestError("trainName, trainNumber, coachName and seats are required")
    }

    if (!Array.isArray(seats) || seats.length === 0){
        throw new BadRequestError("Atleast one seats must be present");
    }
    const train = await trainService.createTrain({ trainName, trainNumber, coachName, seats });
    return res.status(201).json({
        success: true,
        message : " Train added successfully",
        data: train
    })
});

export const createRouteController = asyncHandler(async(req,res)=>{
    const {trainId,stations} = req.body;
    if(!trainId || !stations || !Array.isArray(stations)) {
        throw new BadRequestError("Staions and TrainId should be present")
    }
    if(stations.length< 2){
        throw new BadRequestError("The stations contain atleast 2 stations")
    }
    const route = await trainService.createRoute({ trainId, stations });
    return res.status(201).data({
        success: true,
        message: "Route created successfully",
        data: route
    })
});

export const getAllTrainController = asyncHandler(async(req,res)=>{
    const allTrain = await trainService.getAllTrain();
    return res.status(200).json({
        success: true,
        message: "All Train data get sucessfully",
        data: allTrain
    })
});

export const getTrainByIdControler = asyncHandler(async(req,res)=>{
    const {trainId} = req.params;
    if(!trainId){
        throw new BadRequestError("Train id is missing");
    }
    const train = await trainService.getTrainById(trainId);
    return res.status(200).json({
        success: true,
        message: 'Finding the particular train successfully',
        data: train
    })
});