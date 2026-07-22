import { asyncHandler } from "../utils/asyncHandler.js";
import { BadRequestError, NotFoundError } from "../utils/error.js";
import userService from "../services/user.service.js"

export const getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    if(!userId){
        throw new BadRequestError("UserId is missing");
    }
    const user = await userService.getProfileT(userId);
    return res.status(200).json({
        success: true,
        message: "Fetched user details",
        data: {
            user
        }
    })
})

export const getUserInternal = asyncHandler(async(req,res)=>{
    const {userId} = req.params;
    if(!userId){
        throw new BadRequestError("User Id is missing");
    }

    const user = userService.getProfileT(userId);
    if(!user){
        throw new NotFoundError("User not found");
    }
    return res.status(200).json({
        success: true,
        data: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
        }
    })
})