import { consumer as defaultConsumer, producer as defaultProducer } from '../../config/kafka.js';
import defaultEmailService from '../../services/email.service.js';
import defaultLogger from '../../config/logger.js';
import { kafkaTopics } from '../../../../common-service/constant/kafka-topics.js';
import { withDLQ } from '../../../../common-service/utils/DLQHandler.js';

export const NOTIFICATION_TOPICS = [
    kafkaTopics.OTP_EMAIL,
    kafkaTopics.WELCOME_EMAIL,
    kafkaTopics.BOOKING_CONFIRMED,
    kafkaTopics.BOOKING_FAILED,
    kafkaTopics.BOOKING_CANCELLED,
];

export class EmailConsumer {
    constructor({
        consumer = defaultConsumer,
        producer = defaultProducer,
        emailService = defaultEmailService,
        logger = defaultLogger,
    } = {}) {
        this.consumer = consumer;
        this.producer = producer;
        this.emailService = emailService;
        this.logger = logger;
    }

    async start() {
        try {
            await this.consumer.connect();
            await this.producer.connect(); // needed for DLQ publishing
            this.logger.info('Email consumer connected to Kafka');

            await this.consumer.subscribe({
                topics: NOTIFICATION_TOPICS,
                fromBeginning: false,
            });

            await this.consumer.run({
                eachMessage: withDLQ(
                    this.producer,
                    kafkaTopics.DLQ_NOTIFICATION,
                    this.logger,
                    async ({ topic, parsedValue }) => {
                        this.logger.info(`Processing message from topic: ${topic}`);
                        await this.handleMessage(topic, parsedValue);
                    }
                ),
            });

            this.logger.info('Email consumer is running and listening for messages...');
        } catch (error) {
            this.logger.error('Failed to start email consumer', { error: error.message });
            throw error;
        }
    }

    async handleMessage(topic, data) {
        if (!data || typeof data !== 'object') {
            this.logger.warn(`Invalid or empty payload on topic: ${topic}`);
            return;
        }

        switch (topic) {
            case kafkaTopics.OTP_EMAIL:
                await this.handleOtpEmail(data);
                break;

            case kafkaTopics.WELCOME_EMAIL:
                await this.handleWelcomeEmail(data);
                break;

            case kafkaTopics.BOOKING_CONFIRMED:
                await this.handleBookingConfirmed(data);
                break;

            case kafkaTopics.BOOKING_FAILED:
                await this.handleBookingFailed(data);
                break;

            case kafkaTopics.BOOKING_CANCELLED:
                await this.handleBookingCancelled(data);
                break;

            default:
                this.logger.warn(`Unknown topic: ${topic}`);
        }
    }

    async handleOtpEmail(data) {
        const { email, otp, ttlMinutes } = data;

        if (!email || !otp) {
            throw new Error('Missing required fields: email or otp');
        }

        await this.emailService.sendOtpEmail(email, otp, ttlMinutes || 5);
        this.logger.info(`OTP email sent to ${email}`);
    }

    async handleWelcomeEmail(data) {
        const { email, firstName } = data;

        if (!email || !firstName) {
            throw new Error('Missing required fields: email or firstName');
        }

        await this.emailService.sendWelcomeEmail(email, firstName);
        this.logger.info(`Welcome email sent to ${email}`);
    }

    async handleBookingConfirmed(data) {
        const { email, bookingId } = data;

        if (!email) {
            this.logger.warn('Skipping booking-confirmed email — no email on event', { bookingId });
            return;
        }

        await this.emailService.sendBookingConfirmedEmail(email, data);
        this.logger.info(`Booking confirmed email sent to ${email}`, { bookingId });
    }

    async handleBookingFailed(data) {
        const { email, bookingId } = data;

        if (!email) {
            this.logger.warn('Skipping booking-failed email — no email on event', { bookingId });
            return;
        }

        await this.emailService.sendBookingFailedEmail(email, data);
        this.logger.info(`Booking failed email sent to ${email}`, { bookingId });
    }

    async handleBookingCancelled(data) {
        const { email, bookingId } = data;

        if (!email) {
            this.logger.warn('Skipping booking-cancelled email — no email on event', { bookingId });
            return;
        }

        await this.emailService.sendBookingCancelledEmail(email, data);
        this.logger.info(`Booking cancelled email sent to ${email}`, { bookingId });
    }

    async stop() {
        await this.consumer.disconnect();
        await this.producer.disconnect();
        this.logger.info('Email consumer disconnected');
    }
}

export const emailConsumer = new EmailConsumer();
export default emailConsumer;
