import { kafkaTpoics } from "../../../../common-service/constant/kafka-topics.js";
import { withDLQ } from "../../../../common-service/utils/DLQHandler.js";
import searchService from "../../services/search.service.js";

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
                kafkaTpoics.ROUTE_CREATED,
                kafkaTpoics.SCHEDULE_CREATED,
                kafkaTpoics.SCHEDULE_CANCELLED,
                // Seat avalable Topic also Important
            ],
            fromBeginning: true,
        });

        await this.consumer.run({
            eachMessage:  withDLQ(this.producer,
                kafkaTpoics.DLQ_SEARCH,
                this.logger,
                async ({
                    topic,
                    partition,
                    message,
                    parsedValue,
                    })=>{
                    this.logger.info(
                        `Processing ${topic}`,{
                            partition,
                            offset: message.offset
                        }
                    );

                    switch(topic){
                        case kafkaTpoics.STATION_CREATED:
                            // indexing the sation
                            await searchService.indexStation(parsedValue)
                            break;
                        case kafkaTpoics.SCHEDULE_CREATED:
                            // indexing the schedule
                            await searchService.indexTrainSchedule(parsedValue)
                            break;
                        case kafkaTpoics.ROUTE_CREATED:
                            //indexing route created
                            await searchService.indexTrainRoute(parsedValue)
                            break;
                        case kafkaTpoics.SCHEDULE_CANCELLED:
                            // cancel Schedule
                            await searchService.cancelindexTrainSchedule(parsedValue)
                            break;

                        default:
                            this.logger.warn(
                                `Unknown topic: ${topic}`
                            );
                    }
                }
            )
        });
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