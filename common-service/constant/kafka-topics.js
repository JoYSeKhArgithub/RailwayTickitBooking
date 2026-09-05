export const kafkaTopics = {
    TRAIN_CREATED: 'admin.train-created',
    STATION_CREATED: 'admin.station-created',
    ROUTE_CREATED: 'admin.route-created',
    SCHEDULE_CREATED: 'admin.schedule-created',
    TRAIN_UPDATED: 'admin.train-updated',
    STATION_UPDATED: 'admin.station-updated',
    ROUTE_UPDATED: 'admin.route-updated',
    SCHEDULE_CANCELLED: 'admin.schedule-cancelled',

    SEAT_AVAILABILITY_UPDATED: 'inventory.seat-availability-updated',

    // Notification topics
    OTP_EMAIL: 'notification.otp-email',
    WELCOME_EMAIL: 'notification.welcome-email',
    BOOKING_CONFIRMED: 'booking.confirmed',
    BOOKING_FAILED: 'booking.failed',
    BOOKING_CANCELLED: 'booking.cancelled',

    // DLQ topics
    DLQ_SEARCH: 'dlq.search-service',
    DLQ_INVENTORY: 'dlq.inventory-service',
    DLQ_NOTIFICATION: 'dlq.notification-service',
};

// Aliases for compatibility
export const kafkaTpoics = kafkaTopics;
export const KAFKA_TOPICS = kafkaTopics;

export const DLQ_MAX_RETRIES = 3;