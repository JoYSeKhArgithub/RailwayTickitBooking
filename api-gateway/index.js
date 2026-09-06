import express from 'express';
import { config } from './src/config/root.js';
import { logger } from './src/config/logger.js';
import { corsMiddleware } from './src/middlewares/cors.middleware.js';
import helmet from 'helmet';
import { reqLogger } from './src/middlewares/req.middleware.js';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { notFound } from './src/middlewares/not_found.middleware.js';
import { errorStash } from './src/middlewares/error.middleware.js';
import router from './src/routers/route.js';
import { startAdmissionWorker } from './src/middlewares/waitingRoom.middleware.js';

const app = express();

app.use(corsMiddleware);
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
}))

app.use(reqLogger);

app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if(config.NODE_ENV === 'development'){
    app.use(morgan('dev'))
}


app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API Gateway is running',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
    });
});

app.use('/api',router);

app.use(notFound);
app.use(errorStash);


let stopAdmissionWorker = null;

const gracefulShutdown = () => {
    logger.info('Received shutdown signal, closing the server gracefully...');
    if (stopAdmissionWorker) {
        stopAdmissionWorker();
        logger.info('Waiting room admission worker stopped');
    }
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });

    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
};

process.on('SIGTERM', gracefulShutdown);

const server = app.listen(config.PORT, () => {
    logger.info(`Api Gateway running at port ${config.PORT}`);
    stopAdmissionWorker = startAdmissionWorker({ queueName: 'booking' });
    logger.info('Waiting room admission worker initialized for booking queue');
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection: ', err);
    server.close(() => process.exit(1));
});