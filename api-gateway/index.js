import express from 'express';
import { config } from './src/config.js';
import { logger } from './src/config/logger.js';
import { corsMiddleware } from './src/middlewares/cors.middleware.js';
import helmet from 'helmet';
import { reqLogger } from './src/middlewares/req.middleware.js';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { notFound } from './src/middlewares/not_found.middleware.js';
import { errorStash } from './src/middlewares/error.middleware.js';
import router from './src/routers/route.js';

const app = express();

app.use(corsMiddleware);
app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
}))

app.use(reqLogger);

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


const gracefulShutdown = ()=>{
    logger.info('Recived shutdown gracully, closing the server gracefully...');
    server.close(()=>{
        logger.info('Server closed');
        process.exit(1);
    })

    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
}

process.on('SIGTERM')

const server = app.listen(config.PORT,()=>{
    logger.info(`Api Gateway running at port ${config.PORT}`)
})

process.on('unhandledRejection',()=>{
    logger.error('unhandle Rejection : ',err);
    server.close(()=> process.exit(1));
})