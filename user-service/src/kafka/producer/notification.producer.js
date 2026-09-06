import { producer, connectProducer } from '../../config/kafka.js';
import { logger } from '../../config/logger.js';
import { kafkaTopics } from '../../../../common-service/constant/kafka-topics.js';

export const KAFKA_TOPICS = {
    OTP_EMAIL: kafkaTopics?.OTP_EMAIL || 'notification.otp-email',
    WELCOME_EMAIL: kafkaTopics?.WELCOME_EMAIL || 'notification.welcome-email',
};

export class NotificationProducer {
    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        if (!this.isInitialized) {
            await connectProducer();
            this.isInitialized = true;
        }
    }

    async sendMessage(topic, key, value) {
        try {
            await this.initialize();

            const message = {
                topic,
                messages: [{
                    key: key || `${topic}-${Date.now()}`,
                    value: JSON.stringify(value),
                    timestamp: Date.now().toString(),
                }],
            };

            const result = await producer.send(message);
            logger.info(`Message sent to kafka topic: ${topic}`, {
                key,
                partition: result[0]?.partition,
                offset: result[0]?.offset,
            });

            return result;
        } catch (error) {
            logger.error(`Failed to send message to kafka topic: ${topic}`, {
                error: error.message,
                stack: error.stack,
                key,
            });
            throw error;
        }
    }

    async sendOtpEmail(email, otp, ttlMinutes = 5) {
        return this.sendMessage(
            KAFKA_TOPICS.OTP_EMAIL,
            `otp-${email}`,
            { email, otp, ttlMinutes }
        );
    }

    async sendWelcomeEmail(email, firstName) {
        return this.sendMessage(
            KAFKA_TOPICS.WELCOME_EMAIL,
            `welcome-${email}`,
            { email, firstName }
        );
    }
}

export const notificationProducer = new NotificationProducer();
export default notificationProducer;
