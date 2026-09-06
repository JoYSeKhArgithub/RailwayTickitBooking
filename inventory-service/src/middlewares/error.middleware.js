import { logger } from "../config/logger.js"
import { config } from "../config/root.js"
import { AppError } from "../utils/error.js"

export const errorMiddleware = (err,req,res,next)=>{
    if(err instanceof AppError){
        return res.status(err.statusCode).json({
            success: false,
            error: err.code,
            message: err.message
        })
    }

    console.error("Unauthorized error")
    if(config.NODE_ENV!== "PRODUCTION"){
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
        success: false,
        error: "SERVER_ERROR",
        message: "Internal Server Error"
    })

}