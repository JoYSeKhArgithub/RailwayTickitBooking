import { kafkaProducer } from '../../config/kafka.js';
import { logger } from '../../config/logger.js';
import { kafkaTopics } from '../../../../common-service/constant/kafka-topics.js';

export class BookingProducer {
    constructor(producer = kafkaProducer) {
        this.producer = producer;
    }

    async publishBookingConfirmed(bookingData) {
        try {
            return await this.producer.sendMessage(
                kafkaTopics.BOOKING_CONFIRMED,
                `booking-${bookingData.bookingId || bookingData.id}`,
                {
                    eventType: 'BOOKING_CONFIRMED',
                    ...bookingData,
                    timestamp: new Date().toISOString(),
                }
            );
        } catch (error) {
            logger.error('Error publishing BOOKING_CONFIRMED to Kafka', {
                bookingId: bookingData.bookingId || bookingData.id,
                error: error.message,
            });
            throw error;
        }
    }

    async publishBookingFailed(bookingData) {
        try {
            return await this.producer.sendMessage(
                kafkaTopics.BOOKING_FAILED,
                `booking-${bookingData.bookingId || bookingData.id}`,
                {
                    eventType: 'BOOKING_FAILED',
                    ...bookingData,
                    timestamp: new Date().toISOString(),
                }
            );
        } catch (error) {
            logger.error('Error publishing BOOKING_FAILED to Kafka', {
                bookingId: bookingData.bookingId || bookingData.id,
                error: error.message,
            });
            throw error;
        }
    }

    async publishBookingCancelled(bookingData) {
        try {
            return await this.producer.sendMessage(
                kafkaTopics.BOOKING_CANCELLED,
                `booking-${bookingData.bookingId || bookingData.id}`,
                {
                    eventType: 'BOOKING_CANCELLED',
                    ...bookingData,
                    timestamp: new Date().toISOString(),
                }
            );
        } catch (error) {
            logger.error('Error publishing BOOKING_CANCELLED to Kafka', {
                bookingId: bookingData.bookingId || bookingData.id,
                error: error.message,
            });
            throw error;
        }
    }
}

export const bookingProducer = new BookingProducer();
export default bookingProducer;
