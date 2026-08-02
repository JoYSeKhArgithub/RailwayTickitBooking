import { kafkaTpoics } from "../../../common-service/constant/kafka-topics.js";
import { producer } from "../config/kafka.js";


export class AdminProducer{
    constructor(producer){
        this.producer = producer
    }

    async publishStationCreated(station){
        return this.producer.sendMessage(
            kafkaTpoics.STATION_CREATED,
            `station-${station.id}`,
            {
                eventType: "STATION_CREATED",
                data: station,
                timestamp: new Date().toISOString()
            }
        )
    }
    
    async publishTrainCreated(train){
        return this.producer.sendMessage(
            kafkaTpoics.TRAIN_CREATED,
            `train-${train.id}`,
            {
                eventType: "TRAIN_CREATED",
                data: train,
                timestamp: new Date().toISOString(),
            }
        )
    }

    async publishRouteCreated(route) {
        return this.producer.sendMessage(
            kafkaTpoics.ROUTE_CREATED,
            `route-${route.id}`,
            {
                eventType: "ROUTE_CREATED",
                data: route,
                timestamp: new Date().toISOString(),
            }
        );
    }

    async publishScheduleCreated(schedule) {
        return this.producer.sendMessage(
            kafkaTpoics.SCHEDULE_CREATED,
            `schedule-${schedule.scheduleId}`,
            {
                eventType: "SCHEDULE_CREATED",
                data: schedule,
                timestamp: new Date().toISOString(),
            }
        );
    }

    async publishScheduleCancelled(schedule) {
        return this.producer.sendMessage(
            kafkaTpoics.SCHEDULE_CANCELLED,
            `schedule-${schedule.id}`,
            {
                eventType: "SCHEDULE_CANCELLED",
                data: schedule,
                timestamp: new Date().toISOString(),
            }
        );
    }
}

export const adminProducer = new AdminProducer(producer);
