import searchService from "../services/search.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";

export const searchController = asyncHandler(async(req,res)=>{
    const {from,to,date} = req.query;
    if(!from || !to) throw new BadRequestError('From and to for searching train is required');
    const result = await searchService.searchTrainService(from,to,date || null);
    res.status(200).json({
        success: true,
        data: result
    })
})

export const AutoComplteStationConstroller = asyncHandler(async(req,res)=>{
    const {q} = req.query;
    if(!q || q.length<2) throw new BadRequestError("Provide atleast 2 character for better performe on search");
    const suggestions = await searchService.autocompleteStation(q);
    res.status(200).json({
        success: true,
        data: suggestions
    })
})

export const AllStationController = asyncHandler(async(req,res)=>{
    const data = await searchService.getAlllStations();
    res.status(200).json({
        success: true,
        count: data.length,
        data
    })
})

export const AllTrainController = asyncHandler(async(req,res)=>{
    const data = await searchService.getAllTrains();
    res.status(200).json({
        success: true,
        count: data.length,
        data
    })
})