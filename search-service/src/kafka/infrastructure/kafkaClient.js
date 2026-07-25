import { Kafka } from "kafkajs";
import { config } from "../../config/root.js";
import { logLevel } from "kafkajs";

export class KafkaClient{
    constructor(){
        this.kafka = new Kafka({
            clientId: config.KAFKA_CLIENT_ID,
            brokers: [config.KAFKA_BROKER || 'localhost:9093'],
            logLevel: logLevel.ERROR,
            retry: {
                initialRetryTime: 300,
                retries: 8,
                maxRetryTime: 30000
            }
        })
    }

    getClient(){
        return this.kafka;
    }
}