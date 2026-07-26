// const app = express()
import express from 'express';
import { corsMiddleWare } from './src/middlewares/cors.middleware.js';
import { reqMiddleware } from './src/middlewares/req.middleware.js';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './src/config/root.js';
import { errorMiddleware } from './src/middlewares/error.middleware.js';
import { logger } from './src/config/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()

app.use(corsMiddleWare)
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
        },
    },
}));

app.use(reqMiddleware);
app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ status: 'ok', service: config.SERVICE_NAME }));
app.use(errorMiddleware);

const startServer = async () => {
    if (process.env.ES_RECREATE_INDICES === 'true') {
        // await recreateIndices();
    } else {
        // await initIndices();
    }
    // await searchConsumer.start();

    const server = app.listen(config.PORT, () => {
        logger.info(`${config.SERVICE_NAME} running on http://localhost:${config.PORT}`);
    });

    const shutdown = async () => {
        logger.info('Shutting down...');
        server.close(async () => {
            await disconnectAll();
            process.exit(0);
        });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
};

startServer();