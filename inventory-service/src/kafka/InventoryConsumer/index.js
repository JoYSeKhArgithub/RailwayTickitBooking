import { InventoryConsumer } from "./InventoryConsumer.js";
import { logger } from "../../config/logger.js";
import { inventoryKafkaConsumer, inventoryKafkaProducer } from "../../config/kafka.js";
import inventoryService from "../../services/inventory.service.js";

export const inventoryConsumer = new InventoryConsumer({
    consumer: inventoryKafkaConsumer,
    producer: inventoryKafkaProducer,
    inventoryService,
    logger
})