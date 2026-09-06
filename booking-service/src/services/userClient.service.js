import axios from "axios";
import { config } from "../config/root.js";
import { logger } from "../config/logger.js";

const client = axios.create({
    baseURL: config.USER_SERVICE_URL,
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
        'x-internal-service-key': config.INTERNAL_SERVICE_KEY,
    },
});


const withRetry = async (fn, maxRetries = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error.response?.status;
            if (status && status >= 400 && status <= 500) throw error;
            if (attempt < maxRetries) {
                const delay = 200 * (2 ** (attempt - 1))
                logger.warn(`User client retry ${attempt}/${maxRetries} after ${delay}ms`, {
                    error: error.message,
                });
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }
    throw lastError;
}

export const userClient = {
    getUserById: async(userId)=> {
        return withRetry(async () => {
            const { data } = await client.get(`/user/internal/${userId}`);
            return data.data;
        });
    },
};

export default userClient;
