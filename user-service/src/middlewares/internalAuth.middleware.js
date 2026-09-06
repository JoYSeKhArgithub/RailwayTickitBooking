import { config } from "../config/root.js";
import { ForebiddenError } from "../utils/error.js";

export const internalAuth = (req,res,next)=>{
    const serviceKey = req.headers['x-internal-service-key'];
    if (!serviceKey || serviceKey !== config.INTERNAL_SERVICE_KEY) {
        throw new ForebiddenError("Invalid or missing internal service key");
    }
    next();
}