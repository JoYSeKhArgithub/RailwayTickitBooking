import { kafkaProducer, searchKafkaConsumer } from "../../config/kafka.js";
import { SearchConsumer } from "./SearchConsumer.js";
import { logger } from "../../config/logger.js";

export const searchConsumer = new SearchConsumer({
    consumer: searchKafkaConsumer,
    producer: kafkaProducer,

    //search service
    logger
})