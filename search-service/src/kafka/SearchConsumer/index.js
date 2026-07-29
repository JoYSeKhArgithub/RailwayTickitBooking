import { kafkaProducer, searchKafkaConsumer } from "../../config/kafka.js";
import { SearchConsumer } from "./SearchConsumer.js";
import { logger } from "../../config/logger.js";
import searchService from "../../services/search.service.js";

export const searchConsumer = new SearchConsumer({
    consumer: searchKafkaConsumer,
    producer: kafkaProducer,
    searchService,
    logger
})