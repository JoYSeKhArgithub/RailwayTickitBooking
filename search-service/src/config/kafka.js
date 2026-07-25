import { KafkaClient } from "../kafka/infrastructure/kafkaClient.js";
import { KafKaConsumer } from "../kafka/infrastructure/kafkaConsumer.js";
import { KafkaProducer } from "../kafka/infrastructure/kafkaProducer.js";

export const searchKafkaConsumer = new KafKaConsumer
(
    KafkaClient,
    'search-service-group-v1'
);
export const kafkaProducer = new KafkaProducer(
    KafkaClient
)