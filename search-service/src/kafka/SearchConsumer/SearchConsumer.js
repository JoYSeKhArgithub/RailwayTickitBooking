import { kafkaTpoics } from "../../../../common-service/constant/kafka-topics.js";
import { withDLQ } from "../../../../common-service/utils/DLQHandler.js";


export class SearchConsumer {
    constructor({
        consumer,
        producer,
        searchService,
        logger
    }){
        this.consumer = consumer;
        this.producer = producer;
        this.searchService = searchService;
        this.logger = logger;
    }
    
    async start(){
        await this.consumer.connect();
        await this.producer.connect();

        this.logger.info("Search consumer connected");

        await this.consumer.subscribe({
            topics: [
                kafkaTpoics.STATION_CREATED,
                kafkaTpoics.TRAIN_CREATED,
                kafkaTpoics.ROUTE_CREATED,
                kafkaTpoics.SCHEDULE_CREATED,
                kafkaTpoics.SCHEDULE_CANCELLED,
                // Seat available Topic also Important
            ],
            fromBeginning: true,
        });

        await this.consumer.run(
            withDLQ(
                this.producer,
                kafkaTpoics.DLQ_SEARCH,
                this.logger,
                async ({ topic, partition, message, parsedValue }) => {
                    this.logger.info(`Processing ${topic}`, {
                        partition,
                        offset: message.offset,
                    });

                    switch (topic) {
                        case kafkaTpoics.STATION_CREATED:
                            await this.searchService.indexStation(parsedValue);
                            break;
                        case kafkaTpoics.TRAIN_CREATED:
                            await this.searchService.indexTrain(parsedValue);
                            break;
                        case kafkaTpoics.SCHEDULE_CREATED:
                            await this.searchService.indexTrainSchedule(parsedValue);
                            break;
                        case kafkaTpoics.ROUTE_CREATED:
                            await this.searchService.indexTrainRoute(parsedValue);
                            break;
                        case kafkaTpoics.SCHEDULE_CANCELLED:
                            await this.searchService.cancelIndexTrainSchedule(parsedValue);
                            break;
                        default:
                            this.logger.warn(`Unknown topic: ${topic}`);
                    }
                }
            )
        );
        this.logger.info(
            "Search consumer running..."
        ); 
    }

    async stop(){
        await this.consumer.disconnect();
        await this.producer.disconnect();
        this.logger.info("Search consumer stoppped")
    }
}