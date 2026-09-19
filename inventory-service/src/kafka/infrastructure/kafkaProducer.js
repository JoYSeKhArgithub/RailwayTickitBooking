import { logger } from "../../config/logger.js";

export class KafkaProducer{
    constructor(kafkaClient){
        this.producer = kafkaClient
        .getClient()
        .producer({
            allowAutoTopicCreation: true,
            transactionTimeout: 30000,
            idempotent: true,
            maxInFlightRequests: 5,
            retry:{
                retries: 5
            }
        });
        this.isConnected = false;
        this.connectionPromise = null;
    }

    async connect(){
        if(this.isConnected) return;
        if(this.connectionPromise) return this.connectionPromise;
        this.connectionPromise = this.producer.connect()
                                    .then(()=> {
                                        this.isConnected = true;
                                        logger.info('Kafka producer connected');
                                    }).catch((error)=>{
                                        logger.error('Kafka producer connection failed', { error: error.message });
                                        throw error;
                                    }).finally(()=>{
                                        this.connectionPromise = null;
                                    });
        return this.connectionPromise;
    }

    async disconnect(){
        if(!this.isConnected) return;
        await this.producer.disconnect();
        this.isConnected = false;
        logger.info('Kafka producer disconnected');
    }

    async sendMessage({ topic, key, value, headers = {} }) {
        await this.connect();
        const result = await this.producer.send({
            topic,
            messages: [
                {
                    key: key || `${topic}-${Date.now()}`,
                    value: JSON.stringify(value),
                    headers,
                    timestamp: Date.now().toString(),
                },
            ],
        });
        logger.info(`Message sent to topic: ${topic}`, {
            key,
            partition: result[0].partition,
            offset: result[0].offset,
        });
        return result;
    }
}