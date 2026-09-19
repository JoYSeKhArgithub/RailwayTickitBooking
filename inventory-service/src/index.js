import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config/root.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { reqMiddleware } from './middlewares/req.middleware.js';
import { corsMiddleWare } from './middlewares/cors.middleware.js';
import inventoryRoutes from './routes/inventory.route.js';
import { inventoryConsumer } from './kafka/InventoryConsumer/index.js';
import { startLockExpiryJob, stopLockExpiryJob } from './utils/lockExpiry.js';

const app = express();

app.use(corsMiddleWare);
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(reqMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.send('Hello from inventory-service');
});

app.get('/health', async (req, res) => {
    let dbHealthy = false;
    try {
        await prisma.$queryRaw`SELECT 1`;
        dbHealthy = true;
    } catch (healthError) {
        logger.error('Health check: DB unreachable', { error: healthError.message });
    }

    res.status(dbHealthy ? 200 : 503).json({
        success: dbHealthy,
        message: dbHealthy ? 'Inventory Service is healthy' : 'Inventory Service is degraded',
        database: dbHealthy,
        timestamp: new Date().toISOString(),
    });
});

app.use(inventoryRoutes);

app.use(errorMiddleware);

const startServer = async () => {
    try {
        await inventoryConsumer.start();
        startLockExpiryJob();

        const server = app.listen(config.PORT, () => {
            logger.info(`${config.SERVICE_NAME} is running on port ${config.PORT}`);
        });

        let isShuttingDown = false;
        const shutdown = async (signal) => {
            if (isShuttingDown) return;
            isShuttingDown = true;
            logger.info(`Received ${signal}. Shutting down inventory-service gracefully...`);

            stopLockExpiryJob();

            server.close(async () => {
                try {
                    await inventoryConsumer.stop();
                    await prisma.$disconnect();
                    logger.info('Server and background services closed cleanly');
                } catch (cleanupErr) {
                    logger.error('Error during cleanup', { error: cleanupErr.message });
                } finally {
                    process.exit(0);
                }
            });
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (startupError) {
        logger.error(`Failed to start server: ${startupError.message}`, { stack: startupError.stack });
        process.exit(1);
    }
};

startServer();