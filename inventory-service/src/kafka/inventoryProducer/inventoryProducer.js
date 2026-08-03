import { kafkaTpoics } from "../../../../common-service/constant/kafka-topics.js";

const MAX_PUBLISH_RETRIES = 3;
const RETRY_DELAY_MS = 500;
export class InventoryProducer {
    constructor({ producer, logger }) {
        this.producer = producer;
        this.logger = logger;
    }
    async sendMessage(topic, key, value) {
        await this.producer.connect(); 
        let lastError;
        for (let attempt = 1; attempt <= MAX_PUBLISH_RETRIES; attempt++) {
            try {
               
                const result = await this.producer.sendMessage({
                    topic,
                    key: key || `${topic}-${Date.now()}`,
                    value
                });
                return result;
            } catch (error) {
                lastError = error;
                this.logger.error(`Failed to send message to ${topic} (attempt ${attempt}/${MAX_PUBLISH_RETRIES})`, {
                    error: error.message,
                    key,
                });
                let delay = RETRY_DELAY_MS* (2**(attempt-1));
                if (attempt < MAX_PUBLISH_RETRIES) {
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        this.logger.error(`All ${MAX_PUBLISH_RETRIES} publish attempts failed for ${topic}`, { key });
        throw lastError;
    }
    async publishSeatAvailabilityUpdated(scheduleId, trainId, available, locked, booked) {
        return this.sendMessage(
            kafkaTpoics.SEAT_AVAILABILITY_UPDATED,
            `schedule-${scheduleId}`,
            { scheduleId, trainId, available, locked, booked }
        );
    }
}