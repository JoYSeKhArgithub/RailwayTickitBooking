import { DLQ_MAX_RETRIES } from "../constant/kafka-topics.js";

export const withDLQ = (producer, dlqTopic, logger, handler)=>{
    const retryLogic = new Map();
    return async({topic,partition,message})=>{
        const messageKey = `${topic}:${partition}:${message.offset}`;
        const attempt = (retryLogic.get(messageKey) || 0) + 1;
        retryLogic.set(messageKey,attempt);
        let parsedValue;
        try {
            parsedValue = JSON.parse(message.value.toString());
        } catch (error) {
            logger.error(`Unparsable message on ${topic}, sending to DLQ`,{
                partition,
                offset: message.offset,
                error: error.message
            });
            await sendDLQ(producer, dlqTopic, topic,partition, message, error,logger);
            retryLogic.delete(messageKey);
            return;
        }
        try {
            await handler({ topic, partition, message, parsedValue });
        } catch (error) {
            logger.error(`Error processing ${topic}  (attempt ${attempt}/${DLQ_MAX_RETRIES})`,{
                error: error.message,
                partition,
                offset: message.offset
            });
            if(attempt>=DLQ_MAX_RETRIES){
                logger.error(`Max retries exce exceeded for ${topic}, sending to DLQ`,{
                    partition,
                    message: message.offset
                });
                await sendDLQ(producer,dlqTopic,topic,partition,message,error,logger);
                retryLogic.delete(messageKey);
            }else{
                throw error;
            }
        }
    }
}

export const sendDLQ = async (producer, dlqTopic, originalTopic,partition,message,error,logger)=>{
    try {
        await producer.send({
            topic: dlqTopic,
            messages: [{
                key: message.key,
                value: message.value,
                headers: {
                    ...message.headers,
                    'dlq-original-topic': originalTopic,
                    'dlq-original-partition': String(partition),
                    'dlq-original-offset': message.offset,
                    'dlq-error': error.message,
                    'dlq-timestamp': new Date().toISOString(),
                }
            }]
        })
        logger.info(`Message sent to DLQ: ${dlqTopic}`, { originalTopic, partition, offset: message.offset });
    } catch (error) {
        logger.error(`Failed to send message to DLQ ${dlqTopic}`, {
            error: error.message,
            originalTopic,
            partition,
            offset: message.offset,
        });
    }
}