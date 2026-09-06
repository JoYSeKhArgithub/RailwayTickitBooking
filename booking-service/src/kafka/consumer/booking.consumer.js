import { bookingKafkaConsumer, kafkaProducer } from '../../config/kafka.js';
import { logger } from '../../config/logger.js';
import { kafkaTopics } from '../../../../common-service/constant/kafka-topics.js';
import bookingService from '../../services/booking.service.js';

const PAYMENT_TOPICS = {
    PAYMENT_SUCCESS: 'payment.success',
    PAYMENT_FAILED: 'payment.failed',
    SCHEDULE_CANCELLED: kafkaTopics.SCHEDULE_CANCELLED || 'admin.schedule-cancelled',
};

export class BookingConsumer {
    constructor(consumer = bookingKafkaConsumer, producer = kafkaProducer) {
        this.consumer = consumer;
        this.producer = producer;
    }

    async start() {
        try {
            await this.consumer.connect();
            logger.info('Booking consumer connected to Kafka');

            const topicsToSubscribe = [
                PAYMENT_TOPICS.PAYMENT_SUCCESS,
                PAYMENT_TOPICS.PAYMENT_FAILED,
                PAYMENT_TOPICS.SCHEDULE_CANCELLED,
            ];

            await this.consumer.subscribe({
                topics: topicsToSubscribe,
                fromBeginning: false,
            });

            await this.consumer.run(async ({ topic, partition, message }) => {
                let parsedValue;
                try {
                    parsedValue = JSON.parse(message.value.toString());
                } catch (err) {
                    logger.error(`Error parsing message on ${topic}`, { error: err.message });
                    return;
                }

                logger.info(`Received event on ${topic}`, {
                    partition,
                    offset: message.offset,
                    eventType: parsedValue.eventType,
                    bookingId: parsedValue.bookingId,
                });

                try {
                    if (topic === PAYMENT_TOPICS.PAYMENT_SUCCESS) {
                        const paymentOrderId = parsedValue.paymentOrderId || parsedValue.data?.paymentOrderId;
                        const gatewayPaymentId = parsedValue.gatewayPaymentId || parsedValue.data?.gatewayPaymentId;
                        const amount = parsedValue.amount || parsedValue.data?.amount;
                        await bookingService.handlePaymentSuccess(paymentOrderId, gatewayPaymentId, amount);
                    } else if (topic === PAYMENT_TOPICS.PAYMENT_FAILED) {
                        const paymentOrderId = parsedValue.paymentOrderId || parsedValue.data?.paymentOrderId;
                        const reason = parsedValue.reason || parsedValue.data?.reason;
                        await bookingService.handlePaymentFailure(paymentOrderId, reason);
                    } else if (topic === PAYMENT_TOPICS.SCHEDULE_CANCELLED) {
                        const scheduleId = parsedValue.scheduleId || parsedValue.data?.id || parsedValue.data?.scheduleId || parsedValue.id;
                        await bookingService.handleScheduleCancelled(scheduleId);
                    }
                } catch (handlerErr) {
                    logger.error(`Error handling event on topic ${topic}`, {
                        error: handlerErr.message,
                        payload: parsedValue,
                    });
                }
            });

            logger.info('Booking consumer running and listening for messages...');
        } catch (error) {
            logger.warn('Failed to start booking consumer (Kafka may be offline)', {
                error: error.message,
            });
        }
    }

    async stop() {
        try {
            await this.consumer.disconnect();
            logger.info('Booking consumer stopped');
        } catch (err) {
            logger.error('Error stopping booking consumer', { error: err.message });
        }
    }
}


export const bookingConsumer = new BookingConsumer();
export default bookingConsumer;
