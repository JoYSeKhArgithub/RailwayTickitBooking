import {Redis} from 'ioredis';
import { config } from '../root.js';
import { logger } from '../logger.js';

class RedisClient {
    static instance;
    static isConnected = false;

    constructor(){}

    static getInstance(){
        if(!RedisClient.instance){
            RedisClient.instance = new Redis(config.REDIS_URL,{
                retryStrategy: (times)=>{
                    const delay = Math.min(times*50,2000);
                    return delay;
                },
                maxRetriesPerRequest: 3
            })
            RedisClient.setupEventListeners();
        }
        return RedisClient.instance;
    }

    static setupEventListeners(){
        RedisClient.instance.on('connect',()=>{
            RedisClient.isConnected = true;
            logger.info('Connected tp Redis');
        })

        RedisClient.instance.on('error',(error)=>{
            RedisClient.isConnected = false;
            logger.error("Redis connection error",error);
        })

        RedisClient.instance.on('close',()=>{
            RedisClient.isConnected = false;
            logger.warn('Redis Connecton close')
        })
        RedisClient.instance.on('reconnecting',()=>{
            logger.warn('Reconnected to the redis...')
        })
        RedisClient.instance.on('ready',()=>{
            logger.warn('Redis client is ready');
        })
        RedisClient.instance.on('end',()=>{
            RedisClient.isConnected = false;
            logger.warn('Redis connected ended');
        })
    }

    static async closeConnection(){
        if(RedisClient.instance){
            try {
                await RedisClient.instance.quit();
                RedisClient.instance = null;
                RedisClient.isConnected = false;
                logger.info("Redis connecdtion close")
            } catch (error) {
                logger.info("Error on close connection to redish")
            }
        }
    }

    static isReady(){
        return RedisClient.isConnected;
    }

    static async testingConnection(){
        try {
            await RedisClient.instance.ping();
            return true;
        } catch (error) {
            logger.error("Redis connection test failed");
            return false;
        }
    }
}

export const redis = RedisClient.getInstance();
export { RedisClient };