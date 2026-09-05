import 'dotenv/config';
import express from 'express';
import { config } from './config/root.js';
import { logger } from './config/logger.js';
import { emailConsumer } from './kafka/consumer/email.consumer.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root Service Info
app.get('/', (req, res) => {
    res.status(200).json({
        service: config.SERVICE_NAME,
        status: 'UP',
        timestamp: new Date().toISOString(),
    });
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        service: config.SERVICE_NAME,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
    });
});

app.use(errorMiddleware);

async function startNotificationService() {
    try {
        logger.info(`Starting ${config.SERVICE_NAME}...`);

        const requiredEnvVars = ['SENDGRID_API_KEY', 'MAIL_SEND', 'KAFKA_BROKER'];
        const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        // Start Kafka Consumer
        await emailConsumer.start();

        // Start Express HTTP server for health checks and container probes
        const server = app.listen(config.PORT, () => {
            logger.info(`${config.SERVICE_NAME} HTTP server running on port ${config.PORT}`);
        });

        logger.info('✅ Notification Service started successfully');
        logger.info('Service is ready to process notifications');

        // Graceful shutdown handling
        let isShuttingDown = false;
        const shutdown = async (signal) => {
            if (isShuttingDown) return;
            isShuttingDown = true;
            logger.info(`Received ${signal}. Gracefully shutting down notification service...`);

            server.close(async () => {
                logger.info('HTTP server closed');
                try {
                    await emailConsumer.stop();
                    logger.info('Kafka consumer cleanly stopped');
                    process.exit(0);
                } catch (err) {
                    logger.error('Error during Kafka shutdown', { error: err.message });
                    process.exit(1);
                }
            });

            // Force close after 10s if graceful shutdown hangs
            setTimeout(() => {
                logger.error('Forced shutdown due to timeout');
                process.exit(1);
            }, 10000).unref();
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        logger.error('Failed to start Notification Service', {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    }
}

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

startNotificationService();

export default app;
