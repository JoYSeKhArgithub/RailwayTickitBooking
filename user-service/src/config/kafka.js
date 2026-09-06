import { KafkaClient } from "../kafka/infrastructure/kafkaClient.js";
import { KafkaProducer } from "../kafka/infrastructure/kafkaProducer.js";

const kafkaClientInstance = new KafkaClient();
export const kafkaProducer = new KafkaProducer(kafkaClientInstance);
export const producer = kafkaProducer;
export const connectProducer = async () => kafkaProducer.connect();

export default {
    kafkaClient: kafkaClientInstance,
    kafkaProducer,
    producer: kafkaProducer,
    connectProducer,
};
