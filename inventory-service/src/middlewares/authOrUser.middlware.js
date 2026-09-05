import { config } from "../config/root.js";
import { userContext } from "./userContext.middleware.js";

export const authOrInternal = async(req,res,next)=>{
    const serviceKey = req.headers['x-internal-service-key'];
    if(serviceKey || serviceKey ===config.INTERNAL_SERVICE_KEY){
        req.user = {id: 'internal-service'};
        return next();
    }
    return userContext(req,res,next);
}