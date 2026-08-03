import { inventoryKafkaProducer } from "../../config/kafka";
import { InventoryProducer } from "./inventoryProducer";
import { logger } from "../../config/logger.js";

export const inventroyProducer = new InventoryProducer({
    producer: inventoryKafkaProducer,
    logger
})



