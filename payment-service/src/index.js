import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config/root.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';
import { kafkaProducer } from './config/kafka.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { reqMiddleware } from './middlewares/req.middleware.js';
import { corsMiddleWare } from './middlewares/cors.middleware.js';
import paymentRoutes from './routes/payment.routes.js';
import webhookRoutes from './routes/webhook.route.js';

const app = express();

app.use(corsMiddleWare);
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(reqMiddleware);

app.use('/',webhookRoutes);

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.json({
        service: config.SERVICE_NAME,
        status: "UP",
        timestamp: new Date().toISOString(),
    });
});

app.get('/health', async (req, res) => {
    let dbHealthy = false;
    try {
        await prisma.$queryRaw`SELECT 1`;
        dbHealthy = true;
    } catch (error) {
        logger.error('Health check: DB unreachable', { error: error.message });
    }

    res.status(dbHealthy ? 200 : 503).json({
        success: dbHealthy,
        message: dbHealthy ? 'Payment Service is healthy' : 'Payment Service is degraded',
        database: dbHealthy,
        timestamp: new Date().toISOString(),
    });
});
app.use('/', paymentRoutes);


app.use(errorMiddleware);

const startServer = async () => {
    try {
        kafkaProducer.connect().catch(err => {
            logger.warn('Kafka producer initial connection delayed or failed', { error: err.message });
        });

        const server = app.listen(config.PORT, () => {
            logger.info(`${config.SERVICE_NAME} is running on port ${config.PORT}`);
        });

        const shutdown = async () => {
            logger.info('Shutting down gracefully...');
            await kafkaProducer.disconnect().catch(() => {});
            server.close(async () => {
                logger.info('Payment service server closed');
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (error) {
        logger.error('Failed to start payment server', error);
        process.exit(1);
    }
};

startServer();
