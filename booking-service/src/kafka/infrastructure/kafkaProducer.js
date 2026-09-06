import { logger } from '../../config/logger.js';

export class KafkaProducer {
    constructor(kafkaClient) {
        this.producer = kafkaClient.getClient().producer({
            allowAutoTopicCreation: true,
            retry: {
                retries: 3,
            },
        });
        this.isConnected = false;
        this.connectionPromise = null;
    }

    async connect() {
        if (this.isConnected) return;
        if (this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = this.producer
            .connect()
            .then(() => {
                this.isConnected = true;
                logger.info('Kafka producer connected in booking-service');
            })
            .catch((error) => {
                logger.error('Kafka producer connection failed in booking-service', {
                    error: error.message,
                });
                throw error;
            })
            .finally(() => {
                this.connectionPromise = null;
            });

        return this.connectionPromise;
    }

    async disconnect() {
        if (!this.producer || !this.isConnected) return;
        await this.producer.disconnect();
        this.isConnected = false;
        logger.info('Kafka producer disconnected in booking-service');
    }

    async send(record) {
        await this.connect();
        return this.producer.send(record);
    }

    async sendMessage(topic, key, value, headers = {}) {
        await this.connect();
        const result = await this.producer.send({
            topic,
            messages: [
                {
                    key: key || `${topic}-${Date.now()}`,
                    value: typeof value === 'string' ? value : JSON.stringify(value),
                    headers,
                    timestamp: Date.now().toString(),
                },
            ],
        });

        logger.info('Kafka message published', {
            topic,
            key,
            partition: result[0]?.partition,
            offset: result[0]?.offset,
        });

        return result;
    }

    getProducer() {
        return this.producer;
    }
}

export default KafkaProducer;
