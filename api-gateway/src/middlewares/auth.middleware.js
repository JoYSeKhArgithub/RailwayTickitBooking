import { config } from "../config/root.js";
import { UnauthorizedError } from "../utils/error.js"
import jwt from 'jsonwebtoken';

export const authMiddleware = (req,res,next)=>{
    try {
        let accessToken;
        const authHeader = req.headers.authorization;
        if(authHeader && authHeader.startsWith('Beare ')){
            accessToken = authHeader.split(' ')[1];
        }

        if(!accessToken && req.cookies){
            accessToken = req.cookies.accessToken;
        }

        if(!accessToken){
            throw new UnauthorizedError('Authorization token missing');
        }

        const payload = jwt.verify(accessToken,config.JWT_ACCESS_SECRET);
        if(!payload.id){
            throw new UnauthorizedError('Invalide access token ');
        }
        req.user = {
            id: payload.id
        }

        req.headers['x-user-id'] = payload.id.toString();
        logger.debug(`User ${payload.id} authenticated successfully`);
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError'){
            return next(new UnauthorizedError('Access token expired','TOKEN_EXPIRED'));
        }
        if (error.name === 'JsonWebTokenError'){
            return next(new UnauthorizedError('Invalid access token','TOKEN_INVALID'));
        }
        return next(error);
    }
}