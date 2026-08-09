import axios from "axios";
import { config } from "../config/root.js";

const client = axios.create({
    baseURL: config.PAYMENT_SERVICE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'x-internal-service-key': config.INTERNAL_SERVICE_KEY,
    },
});


const withRetry = async (fn, maxRetries = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error.response?.status;
            if (status && status >= 400 && status <= 500) throw error;
            if (attempt < maxRetries) {
                const delay = 200 * (2 ** (attempt - 1))
                logger.warn(`Payment client retry ${attempt}/${maxRetries} after ${delay}ms`, {
                    error: error.message,
                });
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }
    throw lastError;
}


export const paymentClient ={
    createPaymentOrder: async (bookingId, amount, userId, idempotencyKey)=>{
        return withRetry(async()=>{
            const {data} = await client.post('/orders',{
                bookingId,
                amount,
                userId,
                idempotencyKey,
            });
            return data.data
        })
    }
}