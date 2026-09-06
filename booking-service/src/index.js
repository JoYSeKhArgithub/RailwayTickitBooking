import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { logger } from './config/logger.js';
import { config } from './config/root.js';

import { corsMiddleware } from './middlewares/cors.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { reqLogger } from './middlewares/req.middleware.js';
import { disconnectAll } from './config/kafka.js';
import { RedisClient } from './config/redis.js';

import { prisma } from './config/prisma.js';
import { bookingRoutes } from './routes/booking.route.js';
import { bookingConsumer } from './kafka/consumer/booking.consumer.js';
import { startBookingExpiryJob, stopBookingExpiryJob } from './utils/bookingExpiry.js';

const app = express();

app.use(corsMiddleware);
app.use(
    helmet({
        crossOriginOpenerPolicy: false,
        crossOriginEmbedderPolicy: false,
    })
);
app.use(reqLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.send('Hello from booking-service');
});

app.get('/health', async (req, res) => {
    let dbHealthy = false;
    try {
        await prisma.$queryRaw`SELECT 1`;
        dbHealthy = true;
    } catch (e) {
        logger.error('Health check: DB unreachable', { error: e.message });
    }

    const redisHealthy = RedisClient.isReady();
    const healthy = dbHealthy && redisHealthy;

    res.status(healthy ? 200 : 503).json({
        success: healthy,
        message: healthy ? 'Booking Service is healthy' : 'Booking Service is degraded',
        redis: redisHealthy,
        database: dbHealthy,
        timestamp: new Date().toISOString(),
    });
});

app.use(bookingRoutes);

app.use(errorHandler);

const startServer = async () => {
    try {
        await bookingConsumer.start();
        startBookingExpiryJob();

        const server = app.listen(config.PORT, () => {
            logger.info(`${config.SERVICE_NAME} is running on port ${config.PORT}`);
        });

        let isShuttingDown = false;
        const shutdown = async (signal) => {
            if (isShuttingDown) return;
            isShuttingDown = true;
            logger.info(`Received ${signal}. Shutting down booking-service gracefully...`);

            stopBookingExpiryJob();

            server.close(async () => {
                await disconnectAll();
                await RedisClient.closeConnection();
                logger.info('Booking service server closed');
                process.exit(0);
            });

            setTimeout(() => {
                logger.error('Forced shutdown due to timeout');
                process.exit(1);
            }, 10000).unref();
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
};

startServer();

export default app;
