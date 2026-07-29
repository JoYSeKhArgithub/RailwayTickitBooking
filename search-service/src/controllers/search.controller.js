import searchService from "../services/search.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error";

export const searchController = asyncHandler(async(req,res)=>{
    const {from,to,date} = req.query;
    if(!from || !to) throw new BadRequestError('From and to for searching train is required');
    const result = await searchService.searchTrainService(from,to,date || null);
    res.satus(200).json({
        success: true,
        data: result
    })
})