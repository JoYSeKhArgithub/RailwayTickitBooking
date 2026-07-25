import {logger} from '../../config/logger.js'

export class KafkaProducer{
    constructor(kafkaClient){
        this.producer = kafkaClient
        .getClient()
        .producer({
            allowAutoTopicCreation: true,

            retry: {
                retries: 3,
            },
        });
        this.isConnected = false;
        this.connectionPromise = null;
    }

    async connect(){
        if(this.isConnected){
            return;
        }
        if(this.connectionPromise){
            return this.connectionPromise;
        }
        this.connectionPromise = this.producer.connect().then(()=>{
            this.isConnected = true;
            logger.info("Kafka producer connected");
        })
        .cacth((error)=>{
            logger.error("Kafka producer connection failed",{
                error: error.message
            });
            throw error;
        }).finnaly(()=>{
            this.connectionPromise = null;
        });
        return this.connectionPromise;
    }

    async disconnect(){
        if(!this.isConnected){
            return;
        }
        await this.producer.disconnect();
        this.isConnected = false;
        logger.info("Kafka producer disconnected");
    }

    async sendMessage({
        topic,
        key,
        value,
        headers = {},
    }){
        await this.connect();
        const result = await this.producer.send({
            topic,
            acks: -1,
            message: [
                {
                    key: key || `${topic}-${Date.now()}`,
                    value: JSON.stringify(value),
                    headers,
                    timestamp: Date.now().toString(),
                }
            ]
        });
        logger.info("Kafka message sent", {
            topic,
            key,
            partition: result[0].partition,
            offset: result[0].offset,
        });

        return result;
    }
}