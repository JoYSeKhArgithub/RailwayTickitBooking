import { kafkaTpoics } from "../../../../common-service/constant/kafka-topics.js";
import { withDLQ } from "../../../../common-service/utils/DLQHandler.js";

export class InventoryConsumer{
    constructor({consumer,producer,inventoryService,logger}){
        this.consumer = consumer;
        this.producer = producer;
        this.inventoryService = inventoryService;
        this.logger = logger
    }

    async start() {
        await this.consumer.connect();
        await this.producer.connect(); 
        this.logger.info('Inventory consumer connected');
        await this.consumer.subscribe({
            topics: [
                kafkaTpoics.SCHEDULE_CREATED,
                kafkaTpoics.SCHEDULE_CANCELLED,
            ],
            fromBeginning: true,
        });
        await this.consumer.run(
             withDLQ(
                this.producer,
                kafkaTpoics.DLQ_INVENTORY,
                this.logger,
                async ({ topic, partition, message, parsedValue }) => {
                    this.logger.info(`Processing ${topic}`, {
                        partition,
                        offset: message.offset,
                    });
                    switch (topic) {
                        case kafkaTpoics.SCHEDULE_CREATED:
                            await this.inventoryService.initializeInventory(parsedValue);
                            break;
                        case kafkaTpoics.SCHEDULE_CANCELLED:
                            await this.inventoryService.cancelScheduleInventory(parsedValue);
                            break;
                        default:
                            this.logger.warn(`Unhandled topic: ${topic}`);
                    }
                }
            ),
        );
        this.logger.info('Inventory consumer running...');
    }
    async stop() {
        await this.consumer.disconnect();
        await this.producer.disconnect();
        this.logger.info('Inventory consumer stopped');
    }
}