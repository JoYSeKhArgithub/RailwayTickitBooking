import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config/root.js';
import { logger } from './config/logger.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { reqMiddleware } from './middlewares/req.middleware.js';
import { corsMiddleWare } from './middlewares/cors.middleware.js';
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

app.get("/", (req, res) => {
    res.send("Hello from inventory-service");
})

app.get('/health',async(req,res)=>{
    let dbHealth = false;
    try {
        await prisma.$queryRaw`SELECT 1`;
        dbHealthy = true;
    } catch (error) {
        logger.error('Health check: DB unreachable', { error: error.message });
    }

    res.status(dbHealthy ? 200 : 503).json({
        success: dbHealthy,
        message: dbHealthy ? 'Inventory Service is healthy' : 'Inventory Service is degraded',
        database: dbHealthy,
        timestamp: new Date().toISOString(),
    });
})

app.use(errorMiddleware)



const stratServer = async()=>{
    try {
        const server = app.listen(config.PORT,()=>{
            logger.info(`${config.SERVICE_NAME} is running on port ${config.PORT}`)
        });
        const shutdown = async()=>{
            logger.info('Shutting down gracefully');

            server.close(async()=>{
                logger.info('Server Closed');
                process.exit(0);
            })
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
};

stratServer();