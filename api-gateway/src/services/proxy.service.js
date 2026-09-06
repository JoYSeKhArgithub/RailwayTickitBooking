import axios from "axios";
import { logger } from "../config/logger.js";
import { CircuitBreakerState, config } from "../config/root.js";
import { GatewayTimeoutError, ServiceUnavailableError } from "../utils/error.js";

export class CircuitBreaker {
    constructor(serviceName, threshold = config.CIRCUIT_BREAKER_THRESHOLD, timeout = config.CIRCUIT_BREAKER_TIMEOUT) {
        this.serviceName = serviceName;
        this.failureCount = 0;
        this.threshold = threshold;
        this.timeout = timeout;
        this.state = CircuitBreakerState.CLOSED; 
        this.nextAttempt = Date.now();
    }

    async execute(request) {
        if (this.state === CircuitBreakerState.OPEN) {
            if (Date.now() < this.nextAttempt) {
                throw new ServiceUnavailableError(
                    `Service ${this.serviceName} is temporarily unavailable. Circuit breaker is OPEN.`
                );
            }
            this.state = CircuitBreakerState.HALF_OPEN;
            logger.info(`Circuit breaker HALF_OPEN for ${this.serviceName}`);
        }

        try {
            const response = await request();
            this.onSuccess();
            return response;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.state = CircuitBreakerState.CLOSED;
            logger.info(`Circuit breaker CLOSED for ${this.serviceName}`);
        }
    }

    onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.threshold) {
            this.state = CircuitBreakerState.OPEN;
            this.nextAttempt = Date.now() + this.timeout;
            logger.error(
                `Circuit breaker OPEN for ${this.serviceName}. Next attempt at ${new Date(this.nextAttempt).toISOString()}`
            );
        }
    }

    getState() {
        return {
            service: this.serviceName,
            state: this.state,
            failureCount: this.failureCount,
            nextAttempt: this.state === CircuitBreakerState.OPEN ? new Date(this.nextAttempt).toISOString() : null,
        };
    }
}

export const circuitBreakers = {
    userService: new CircuitBreaker('user-service'),
    adminService: new CircuitBreaker('admin-service'),
    searchService: new CircuitBreaker('search-service'),
    inventoryService: new CircuitBreaker('inventory-service'),
    bookingService: new CircuitBreaker('booking-service'),
    paymentService: new CircuitBreaker('payment-service'),
};



export async function forwardRequest(serviceUrl, path, method, data, headers, circuitBreaker, rawBody = null) {
    const url = `${serviceUrl}${path}`;
    logger.info(`Proxying to: ${method} ${url}`);

    const forwardedHeaders = {
        ...headers,
        'x-internal-service-key': config.INTERNAL_SERVICE_KEY,
        host: undefined,
        'content-length': undefined,
    };

    const requestConfig = {
        method,
        url,
        timeout: config.SERVICE_TIMEOUT_MS,
        headers: forwardedHeaders,
        validateStatus: () => true,
        maxRedirects: 5,
    };

    if (method !== 'GET' && method !== 'DELETE') {
        if (rawBody && Buffer.isBuffer(rawBody)) {
            requestConfig.data = rawBody;
        } else if (data) {
            requestConfig.data = data;
        }
    }

    if ((method === 'GET' || method === 'DELETE') && data) {
        requestConfig.params = data;
    }

    logger.debug(`Forwarding ${method} ${url}`, {
        headers: requestConfig.headers,
        hasData: !!requestConfig.data,
        timeout: config.SERVICE_TIMEOUT_MS,
    });

    try {
        const response = await circuitBreaker.execute(() => axios(requestConfig));

        logger.debug(`Response from ${url}:`, {
            status: response.status,
            statusText: response.statusText,
        });

        return {
            status: response.status,
            data: response.data,
            headers: response.headers,
        };
    } catch (err) {
        logger.error(`Error forwarding to ${serviceUrl}:`, {
            message: err.message,
            code: err.code,
            url: url,
            method: method,
            timeout: config.SERVICE_TIMEOUT_MS,
        });

        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            throw new GatewayTimeoutError(`Request to ${serviceUrl} timed out after ${config.SERVICE_TIMEOUT_MS}ms`);
        }

        if (err.code === 'ECONNREFUSED') {
            throw new ServiceUnavailableError(`Cannot connect to ${serviceUrl}. Service may be down.`);
        }

        if (err.response) {
            logger.error(`Service error from ${serviceUrl}:`, {
                status: err.response.status,
                data: err.response.data,
            });

            return {
                status: err.response.status,
                data: err.response.data,
                headers: err.response.headers,
            };
        }

        logger.error(`Network error while calling ${serviceUrl}:`, err.message);
        throw new ServiceUnavailableError(`Service temporarily unavailable: ${err.message}`);
    }
}

export function createProxy(serviceName, serviceUrl, options = { stripPrefix: true }) {
    const circuitBreaker = circuitBreakers[serviceName];

    if (!circuitBreaker) {
        throw new Error(`No circuit breaker found for service: ${serviceName}`);
    }

    return async (req, res, next) => {
        try {
            let servicePath;
            if (options.stripPrefix) {
                const pathParts = req.path.split('/').filter(Boolean);
                servicePath = '/' + pathParts.slice(1).join('/');
            } else {
                servicePath = req.path;
            }

            if (!servicePath.startsWith('/')) {
                servicePath = '/' + servicePath;
            }

            const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
            const fullTargetUrlPath = servicePath + queryString;

            const result = await forwardRequest(
                serviceUrl,
                fullTargetUrlPath,
                req.method,
                req.body,
                req.headers,
                circuitBreaker,
                req.rawBody
            );

            const excludeHeaders = ['connection', 'keep-alive', 'transfer-encoding', 'host'];
            Object.keys(result.headers).forEach((key) => {
                if (!excludeHeaders.includes(key.toLowerCase())) {
                    res.setHeader(key, result.headers[key]);
                }
            });

            res.status(result.status).json(result.data);
        } catch (err) {
            next(err);
        }
    };
}


export function getCircuitBreakerStatus() {
    return Object.values(circuitBreakers).map((cb) => cb.getState());
}
