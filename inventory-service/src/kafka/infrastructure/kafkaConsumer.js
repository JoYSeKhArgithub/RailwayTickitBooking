import { logger } from "../../config/logger.js";

export class KafkaConsumer{
    constructor(kafkaClient,groupId){
        this.groupId = groupId;
        this.consumer = kafkaClient
        .getClient()
        .consumer({
            groupId,
            sessionTimeout: 30000,
            heartbeatInterval: 3000
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
        this.connectionPromise = this.consumer
        .connect()
        .then(()=>{
            this.isConnected = true;
            logger.info("Kafka consumer conneted",{
                group: this.groupId
            })
        }).catch((error)=>{
            logger.error(
                "Kafka consumer connection failed",
                    {
                        error: error.message
                    }
                )
            throw error;
        }).finally(()=>{
            this.connectionPromise = null;
        })
        return this.connectionPromise;
    }

    async subscribe({
        topics,
        fromBeginning = false
    }){
        await this.connect();
        for(const topic of topics){
            await this.consumer.subscribe({
                topic,
                fromBeginning
            })
        }
    }

    async run(eachMessage){
        await this.connect();
        return this.consumer.run({
            eachMessage
        })
    }

    async disconnect(){
        if(!this.consumer){
            return;
        }
        await this.consumer.disconnect();
        this.isConnected = false;
        logger.info("Kafka consumer disconnected",{
            groupId: this.groupId
        })        
    }
}