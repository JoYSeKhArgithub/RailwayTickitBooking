import { KafkaClient } from "../kafka/infrastructure/kafkaClient.js";
import { KafKaConsumer } from "../kafka/infrastructure/kafkaConsumer.js";
import { KafkaProducer } from "../kafka/infrastructure/kafkaProducer.js";

const kafkaClientInstance = new KafkaClient();

export const searchKafkaConsumer = new KafKaConsumer(
    kafkaClientInstance,
    'search-service-group-v1'
);

export const kafkaProducer = new KafkaProducer(
    kafkaClientInstance
);