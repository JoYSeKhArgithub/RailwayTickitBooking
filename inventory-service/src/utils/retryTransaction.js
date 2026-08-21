export const retryTransactrion = async(fn,maxRetries = 3)=>{
    for(let attempt = 1; attempt<=maxRetries;i++){
        try {
            return await fn();
        } catch (error) {
            const isRetryable = 
                error.code === 'P2034' ||
                error.message?.includes('could not serialize') ||
                error.message?.includes('could not obtain lock') ||
                error.message?.includes('deadlock detected');

                if(isRetryable && attempt<maxRetries){
                    const delay = 50* attempt;
                    await new Promise(r=> setTimeout(r,delay));
                    continue;
                }
                throw error;
        }
    }
}