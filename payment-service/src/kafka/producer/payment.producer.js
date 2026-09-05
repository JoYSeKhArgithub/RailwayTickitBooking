import { kafkaProducer } from "../../config/kafka.js";
import { logger } from "../../config/logger.js";

export const PAYMENT_TOPICS = {
    PAYMENT_SUCCESS: 'payment.success',
    PAYMENT_FAILED: 'payment.failed',
    REFUND_SUCCESS: 'payment.refund-success',
};

export class PaymentProducer {
    constructor(producer) {
        this.producer = producer;
    }

    async publishPaymentSuccess(paymentOrderId, bookingId, gatewayPaymentId, amount) {
        try {
            return await this.producer.sendMessage(
                PAYMENT_TOPICS.PAYMENT_SUCCESS,
                `booking-${bookingId}`,
                {
                    eventType: 'PAYMENT_SUCCESS',
                    paymentOrderId,
                    bookingId,
                    gatewayPaymentId,
                    amount,
                    timestamp: new Date().toISOString(),
                }
            );
        } catch (error) {
            logger.error('Error publishing PAYMENT_SUCCESS to Kafka', {
                paymentOrderId,
                bookingId,
                error: error.message,
            });
            throw error;
        }
    }

    async publishPaymentFailed(paymentOrderId, bookingId, reason) {
        try {
            return await this.producer.sendMessage(
                PAYMENT_TOPICS.PAYMENT_FAILED,
                `booking-${bookingId}`,
                {
                    eventType: 'PAYMENT_FAILED',
                    paymentOrderId,
                    bookingId,
                    reason,
                    timestamp: new Date().toISOString(),
                }
            );
        } catch (error) {
            logger.error('Error publishing PAYMENT_FAILED to Kafka', {
                paymentOrderId,
                bookingId,
                error: error.message,
            });
            throw error;
        }
    }

    async publishRefundSuccess(paymentOrderId, refundId, amount, reason) {
        try {
            return await this.producer.sendMessage(
                PAYMENT_TOPICS.REFUND_SUCCESS,
                `payment-${paymentOrderId}`,
                {
                    eventType: 'REFUND_SUCCESS',
                    paymentOrderId,
                    refundId,
                    amount,
                    reason,
                    timestamp: new Date().toISOString(),
                }
            );
        } catch (error) {
            logger.error('Error publishing REFUND_SUCCESS to Kafka', {
                paymentOrderId,
                refundId,
                error: error.message,
            });
            throw error;
        }
    }
}

export const paymentProducer = new PaymentProducer(kafkaProducer);
export default paymentProducer;
