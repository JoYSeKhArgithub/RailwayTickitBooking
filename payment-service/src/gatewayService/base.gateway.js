export class BaseGateway {
    constructor(providerName){
        if(new.target === BaseGateway){
            throw new Error("BaseGateway is not be instantiated directly");
        }
        this.providerName = providerName
    }

    async createOrder(amount,currency,receipt,notes={}){
        throw new Error('CrateOrder is not implemented from the BaseGateWay')
    }
    verifyPaymentSignature(orderId, paymentId, signature) {
        throw new Error('verifyPaymentSignature is not implemented by gateway');
    }
    verifyWebhookSignature(rawBody, signature) {
        throw new Error('verifyWebhookSignature  is not implemented by gateway');
    }
    async fetchPayment(paymentId) {
          throw new Error('fetchPayment is not implemented by gateway');
     }

    async initiateRefund(paymentId, amount, notes = {}) {
          throw new Error('initiateRefund is not implemented by gateway');
     }
    async fetchRefund(paymentId, refundId) {
        throw new Error('fetchRefund is not implemented by gateway');
    }
}