import { KafkaClient } from "../kafka/infrastructure/kafkaClient.js";
import { KafkaProducer } from "../kafka/infrastructure/kafkaProducer.js";

export const kafkaClient = new KafkaClient();

export const producer = new KafkaProducer(kafkaClient);

