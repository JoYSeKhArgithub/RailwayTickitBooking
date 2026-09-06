import axios from 'axios';
import { config } from '../config/root.js';

const client = axios.create({
    baseURL: config.INVENTORY_SERVICE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'x-internal-service-key': config.INTERNAL_SERVICE_KEY
    }
})

const withRetry = async(fn,maxRetries = 3)=>{
    let lastError;
    for(let attempt =1;attempt<=maxRetries;i++){
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error.response?.status;
            if(status && status>=400 && status<=500) throw error;
            if(attempt<maxRetries){
                const delay = 200*( 2**(attempt-1))
                logger.warn(`Inventory client retry ${attempt}/${maxRetries} after ${delay}ms`, {
                    error: error.message,
                });
                await new Promise(resolve=> setTimeout(resolve,delay))
            }
        }
    }
    throw lastError;
}


export function extractError(error) {
    if (error.response?.data) {
        return {
            status: error.response.status,
            message: error.response.data.message || error.message,
            code: error.response.data.error,
        };
    }
    return { status: 500, message: error.message, code: 'INVENTORY_SERVICE_ERROR' };
}


export const inventoryClient = {
    getAvailability: async (scheduleId) => {
        return withRetry(async () => {
            const { data } = await client.get(`/schedules/${scheduleId}/availability`);
            return data.data;
        });
    },

    getAvailableSeats: async (scheduleId) => {
        return withRetry(async () => {
            const { data } = await client.get(`/schedules/${scheduleId}/availability`);
            return data.data;
        });
    },

    getSeats: async (scheduleId, filters = {}) => {
        return withRetry(async () => {
            const params = {};
            if (filters.status) params.status = filters.status;
            if (filters.seatType) params.seatType = filters.seatType;
            if (filters.fromSeq) params.fromSeq = filters.fromSeq;
            if (filters.toSeq) params.toSeq = filters.toSeq;

            const { data } = await client.get(`/schedules/${scheduleId}/seats`, { params });
            return data.data;
        });
    },

    holdSeats: async (scheduleId, seatIds, userId, ttlSec, fromSeq, toSeq) => {
        return withRetry(async () => {
            const { data } = await client.post('/seats/lock', {
                scheduleId,
                seatIds,
                userId,
                ttlSec,
                fromSeq,
                toSeq,
            });
            return data.data;
        });
    },

    confirmSeats: async (scheduleId, seatIds, userId, fromSeq, toSeq) => {
        return withRetry(async () => {
            const { data } = await client.post('/seats/confirm', {
                scheduleId,
                seatIds,
                userId,
                fromSeq,
                toSeq,
            });
            return data.data;
        });
    },

    releaseSeats: async (scheduleId, seatIds, userId, fromSeq, toSeq) => {
        return withRetry(async () => {
            const { data } = await client.post('/seats/unlock', {
                scheduleId,
                seatIds,
                userId,
                fromSeq,
                toSeq,
            });
            return data.data;
        });
    },

    cancelBooking: async (scheduleId, bookingId, userId) => {
        return withRetry(async () => {
            const { data } = await client.post('/seats/cancel-booking', {
                scheduleId,
                bookingId,
                userId,
            });
            return data.data;
        });
    },
};

export const invenToryClient = inventoryClient;
export default inventoryClient;



