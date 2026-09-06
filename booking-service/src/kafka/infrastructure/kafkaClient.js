import { Kafka, logLevel } from 'kafkajs';
import { config } from '../../config/root.js';

export class KafkaClient {
    constructor() {
        this.kafka = new Kafka({
            clientId: config.KAFKA_CLIENT_ID,
            brokers: [config.KAFKA_BROKER || 'localhost:9093'],
            logLevel: logLevel.ERROR,
            retry: {
                initialRetryTime: 300,
                retries: 10,
                maxRetryTime: 30000,
                multiplier: 2,
            },
        });
    }

    getClient() {
        return this.kafka;
    }
}

export default KafkaClient;
