import express from 'express';
import { config } from './config/root.js';
import { logger } from './config/logger.js';
import helmet from 'helmet';
import cookieParser from 'cookie-parser'
import { corsMiddleWare } from './middlewares/cors.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { reqLogger } from './middlewares/req.middleware.js';
import authenticationRouter from './routes/auth.routes.js'
import userRouter from './routes/user.route.js'
const app = express();

app.use(corsMiddleWare)
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false
}))

app.use(reqLogger)
app.use(express.json());
app.use(cookieParser())

app.get("/",(req,res)=>{
    res.send("Hello from the source")
})

app.get("/health",(req,res)=>{
    res.status(200).json({
        message: "ok"
    })
})

app.use(errorMiddleware);

app.use('/ttb/api', authenticationRouter);
app.use('/ttb/api', userRouter);

const startServer = async()=>{
    try {
        const server = app.listen(config.PORT, () => {
            logger.info(`The server is getting started at PORT: ${config.PORT}`)
        })
        const shutDown = async()=>{
            logger.info('Shutdown gracefully ')
            server.close(async()=>{
                logger.info('Server Closed');
                process.exit(0);
            })
        };
        process.on('SIGTERM',shutDown);
        process.on('SIGINT',shutDown);
    } catch (error) {
        logger.error("Failde to start server",error);
        process.exit(1);
    }
}

startServer();