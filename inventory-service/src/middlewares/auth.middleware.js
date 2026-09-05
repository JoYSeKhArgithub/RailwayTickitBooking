import { config } from "../config/root.js";
import { ForbiddenError } from "../utils/error.js";

export const authMiddleware = (req,res,next)=>{
    const serviceKey = req.headers['x-internal-service-key'];

    if(!serviceKey || serviceKey !== config.INTERNAL_SERVICE_KEY){
        throw new ForbiddenError('invalid or missing service key');
    }
    next();
}