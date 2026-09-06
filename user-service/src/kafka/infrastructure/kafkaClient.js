import { Kafka, logLevel } from 'kafkajs';
import { config } from '../../config/root.js';

export class KafkaClient {
    constructor() {
        const brokers = Array.isArray(config.KAFKA_BROKERS)
            ? config.KAFKA_BROKERS
            : [config.KAFKA_BROKER || process.env.KAFKA_BROKER || 'localhost:9093'];

        this.kafka = new Kafka({
            clientId: config.KAFKA_CLIENT_ID || 'user-service',
            brokers,
            logLevel: logLevel.ERROR,
            retry: {
                initialRetryTime: 300,
                retries: 8,
                maxRetryTime: 30000,
            },
        });
    }

    getClient() {
        return this.kafka;
    }
}

export default KafkaClient;
