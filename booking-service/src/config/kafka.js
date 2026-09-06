import { KafkaClient } from '../kafka/infrastructure/kafkaClient.js';
import { KafkaProducer } from '../kafka/infrastructure/kafkaProducer.js';
import { KafkaConsumer } from '../kafka/infrastructure/kafkaConsumer.js';
import { logger } from './logger.js';

export const kafkaClient = new KafkaClient();
export const kafka = kafkaClient.getClient();

export const kafkaProducer = new KafkaProducer(kafkaClient);
export const bookingKafkaConsumer = new KafkaConsumer(kafkaClient, 'booking-service-group');

export const disconnectAll = async () => {
    logger.info('Disconnecting all Kafka connections in booking-service...');
    try {
        await bookingKafkaConsumer.disconnect();
    } catch (err) {
        logger.error('Error disconnecting Kafka consumer', { error: err.message });
    }

    try {
        await kafkaProducer.disconnect();
    } catch (err) {
        logger.error('Error disconnecting Kafka producer', { error: err.message });
    }
};

export default {
    kafkaClient,
    kafka,
    kafkaProducer,
    bookingKafkaConsumer,
    disconnectAll,
};
