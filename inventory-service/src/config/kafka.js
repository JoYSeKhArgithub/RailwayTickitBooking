import { KafkaClient } from "../kafka/infrastructure/kafkaClient.js";
import { KafkaConsumer } from "../kafka/infrastructure/kafkaConsumer.js";

const kafkaClientInstance = new KafkaClient();

export const inventoryKafkaConsumer = new KafkaConsumer(
    kafkaClientInstance,
    'inventory-service-group-v1'
);