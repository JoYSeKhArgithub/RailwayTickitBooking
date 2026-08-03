import { KafkaClient } from "../kafka/infrastructure/kafkaClient.js";
import { KafkaConsumer } from "../kafka/infrastructure/kafkaConsumer.js";
import { KafkaProducer } from "../kafka/infrastructure/kafkaProducer.js";

const kafkaClientInstance = new KafkaClient();

export const inventoryKafkaConsumer = new KafkaConsumer(
    kafkaClientInstance,
    'inventory-service-group-v1'
);

export const inventoryKafkaProducer = new KafkaProducer(kafkaClientInstance)