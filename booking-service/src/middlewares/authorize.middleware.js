import { UnauthorizedError } from "../utils/error.js";

export const authorizeMiddleware = (req,res,next)=>{
    const userId = req.headers['x-user-id'];
    if(!userId){
        return next(new UnauthorizedError('Cannot found the user Id for booking'))
    }
    req.user = {id: userId};
    next();
}