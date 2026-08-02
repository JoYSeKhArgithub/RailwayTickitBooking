import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { logger } from './src/config/logger.js';
import { config } from './src/config/root.js';
import { corsMiddleWare } from './src/middlewares/cors.middleware.js';
import { reqMiddleware } from './src/middlewares/req.middleware.js';
import { errorMiddleware } from './src/middlewares/error.middleware.js';
import stationRoute from './src/routes/station.route.js';
import scheduleRoute from './src/routes/schedule.route.js';
import trainRoute from './src/routes/train.route.js'
import { producer } from './src/config/kafka.js';

const app = express();

app.use(corsMiddleWare);
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(reqMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.use((req,res,next)=>{
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

app.get("/",(req,res)=>{
    res.send("Hello from service js admine pannel")
});

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Admin Service is healthy',
        timestamp: new Date().toISOString()
    });
});

app.use("/stations",stationRoute);
app.use("/trains",trainRoute);
app.use("/schedules",scheduleRoute);

app.use(errorMiddleware);


const startServer = ()=>{
    try {
        const server = app.listen(config.PORT,()=>{
            logger.info(`${config.SERVICE_NAME} is running on port ${config.PORT}`);
        });

        const shutdown = async()=>{
            logger.info("Shutting down gracefully");
            server.close(async()=>{
                // disconneting the producer Kafka
                await producer.disconnect();
                logger.info("Server Closed");
                process.exit(0);
            });
        }

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        logger.error('Failed to start server',error);
        process.exit(1);
    }
}

startServer();