import { KafkaClient } from '../kafka/infrastructure/kafkaClient.js';
import { KafkaConsumer } from '../kafka/infrastructure/kafkaConsumer.js';
import { KafkaProducer } from '../kafka/infrastructure/kafkaProducer.js';
import { logger } from './logger.js';

export const kafkaClient = new KafkaClient();
export const kafka = kafkaClient.getClient();

export const consumer = new KafkaConsumer(kafkaClient, 'notification-service-group');
export const notificationKafkaConsumer = consumer;

export const producer = new KafkaProducer(kafkaClient);
export const notificationKafkaProducer = producer;

export const connectProducer = async () => {
    return producer.connect();
};

export const shutdown = async () => {
    logger.info('Shutting down Kafka connections...');
    await consumer.disconnect();
    await producer.disconnect();
};

export default {
    kafkaClient,
    kafka,
    consumer,
    producer,
    connectProducer,
    shutdown,
};
