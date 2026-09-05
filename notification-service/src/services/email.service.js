import sgMail from '@sendgrid/mail';
import { logger } from '../config/logger.js';
import { config } from '../config/root.js';
import {
    getOtpTemplate,
    getWelcomeTemplate,
    getTicketConfirmationTemplate,
    getBookingConfirmedTemplate,
    getBookingFailedTemplate,
    getBookingCancelledTemplate,
} from '../templates/index.js';

if (config.SENDGRID_API_KEY) {
    sgMail.setApiKey(config.SENDGRID_API_KEY);
}

export class EmailService {
    constructor() {
        this.from = config.MAIL_SEND || 'noreply@designkarle.com';
        this.maxRetries = 3;
    }

    async sendWithRetry(msg, retries = 0) {
        try {
            if (!config.SENDGRID_API_KEY) {
                logger.warn('SENDGRID_API_KEY is not set. Email not sent via network.', {
                    to: msg.to,
                    subject: msg.subject,
                });
                return { success: false, simulated: true };
            }

            await sgMail.send(msg);
            logger.info(`Email sent successfully to ${msg.to}`, {
                subject: msg.subject,
                attempt: retries + 1,
            });
            return { success: true };
        } catch (error) {
            logger.error(`Email sending failed (attempt ${retries + 1}/${this.maxRetries})`, {
                to: msg.to,
                error: error.message,
                code: error.code,
                response: error.response?.body,
            });

            if (retries < this.maxRetries - 1) {
                const delay = Math.pow(2, retries) * 1000;
                await new Promise((resolve) => setTimeout(resolve, delay));
                return this.sendWithRetry(msg, retries + 1);
            }

            throw error;
        }
    }

    async sendOtpEmail(email, otp, ttlMinutes = 5) {
        const msg = {
            to: email,
            from: this.from,
            subject: 'Your DesignKarle verification code',
            html: getOtpTemplate(otp, ttlMinutes),
        };

        return this.sendWithRetry(msg);
    }

    async sendWelcomeEmail(email, firstName) {
        const msg = {
            to: email,
            from: this.from,
            subject: 'Welcome to DesignKarle - Email Verified',
            html: getWelcomeTemplate(firstName),
        };

        return this.sendWithRetry(msg);
    }

    async sendBookingConfirmedEmail(email, bookingData) {
        const msg = {
            to: email,
            from: this.from,
            subject: `Booking Confirmed - ${bookingData.trainName || 'Your Train Ticket'}`,
            html: getBookingConfirmedTemplate(bookingData),
        };

        return this.sendWithRetry(msg);
    }

    async sendBookingFailedEmail(email, bookingData) {
        const msg = {
            to: email,
            from: this.from,
            subject: 'Booking Unsuccessful - Please Try Again',
            html: getBookingFailedTemplate(bookingData),
        };

        return this.sendWithRetry(msg);
    }

    async sendBookingCancelledEmail(email, bookingData) {
        const msg = {
            to: email,
            from: this.from,
            subject: 'Booking Cancelled - Refund Update',
            html: getBookingCancelledTemplate(bookingData),
        };

        return this.sendWithRetry(msg);
    }

    async sendTicketConfirmationEmail(email, ticketData) {
        const msg = {
            to: email,
            from: this.from,
            subject: `Ticket Confirmed - PNR: ${ticketData.pnr || 'N/A'}`,
            html: getTicketConfirmationTemplate(ticketData),
        };

        return this.sendWithRetry(msg);
    }
}

export const emailService = new EmailService();
export default emailService;
