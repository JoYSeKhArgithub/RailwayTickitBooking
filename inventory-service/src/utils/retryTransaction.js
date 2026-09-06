export const retryTransaction = async (operationFn, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operationFn();
        } catch (opError) {
            const isRetryable =
                opError.code === 'P2034' ||
                opError.message?.includes('could not serialize') ||
                opError.message?.includes('could not obtain lock') ||
                opError.message?.includes('deadlock detected');

            if (isRetryable && attempt < maxRetries) {
                const delayMs = 50 * attempt;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                continue;
            }
            throw opError;
        }
    }
};

export const retryTransactrion = retryTransaction;

export default retryTransaction;