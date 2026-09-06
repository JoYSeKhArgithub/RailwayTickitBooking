import { inventoryKafkaProducer } from "../../config/kafka.js";
import { InventoryProducer } from "./inventoryProducer.js";
import { logger } from "../../config/logger.js";

export const inventoryProducer = new InventoryProducer({
    producer: inventoryKafkaProducer,
    logger,
});

export const inventroyProducer = inventoryProducer;

export default inventoryProducer;
