import { UnauthorizedError } from "../utils/error.js";

export const userVerify = (req,res,next)=>{
    const userId = req.headers['x-user-id'];

    if(!userId){
        return next(
            new UnauthorizedError('User context is missing')
        )
    }
    
    req.user = {
        id: userId,
        role: req.headers['x-user-role'] || 'USER'
    };
    next();
}