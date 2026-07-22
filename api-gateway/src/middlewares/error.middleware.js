import { config } from "../config/root.js";
import { AppError } from "../utils/error.js"

export const errorStash = (err,req,res,next)=>{
    if(err instanceof AppError){
        return res.status(err.statusCode).json({
            sucess: false,
            error: err.code,
            message: err.message
        })
    }

    console.log("UNHADLED ERROR: ",err);

    if (config.NODE_ENV !== "production") {
        logger.error({
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            body: req.body,
            query: req.query
        })
    }
    return res.status(500).json({
        sucess: false,
        error: 'SERVER_ERROR',
        message: 'Internal Server Error'
    })
}