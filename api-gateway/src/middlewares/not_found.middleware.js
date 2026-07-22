import { NotFoundError } from "../utils/error.js";

export function notFound(req,res,next){
    next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
}