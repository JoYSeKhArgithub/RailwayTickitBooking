import { logger } from '../../config/logger.js';

export class KafkaConsumer {
    constructor(kafkaClient, groupId = 'booking-service-group') {
        this.groupId = groupId;
        this.consumer = kafkaClient
            .getClient()
            .consumer({
                groupId,
                sessionTimeout: 30000,
                heartbeatInterval: 3000,
            });
        this.isConnected = false;
        this.connectionPromise = null;
    }

    async connect() {
        if (this.isConnected) return;
        if (this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = this.consumer
            .connect()
            .then(() => {
                this.isConnected = true;
                logger.info('Kafka consumer connected in booking-service', { groupId: this.groupId });
            })
            .catch((error) => {
                logger.error('Kafka consumer connection failed in booking-service', {
                    groupId: this.groupId,
                    error: error.message,
                });
                throw error;
            })
            .finally(() => {
                this.connectionPromise = null;
            });

        return this.connectionPromise;
    }

    async subscribe({ topics, fromBeginning = false }) {
        await this.connect();
        const topicList = Array.isArray(topics) ? topics : [topics];
        for (const topic of topicList) {
            await this.consumer.subscribe({
                topic,
                fromBeginning,
            });
        }
        logger.info('Subscribed to Kafka topics in booking-service', { topics: topicList, groupId: this.groupId });
    }

    async run(options) {
        await this.connect();
        const runConfig = typeof options === 'function' ? { eachMessage: options } : options;
        return this.consumer.run(runConfig);
    }

    async disconnect() {
        if (!this.consumer || !this.isConnected) return;
        await this.consumer.disconnect();
        this.isConnected = false;
        logger.info('Kafka consumer disconnected in booking-service', { groupId: this.groupId });
    }

    getConsumer() {
        return this.consumer;
    }
}

export default KafkaConsumer;
