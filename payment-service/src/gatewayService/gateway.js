import { config } from "../config/root.js";
import { RazorpayGateway } from "./razorpay.gateway.js";

export class GatewayFactory {
    static instance = null;

    constructor() {
        if (GatewayFactory.instance) {
            return GatewayFactory.instance;
        }
        this.gatewayInstance = null;
        GatewayFactory.instance = this;
    }

    static getInstance() {
        if (!GatewayFactory.instance) {
            GatewayFactory.instance = new GatewayFactory();
        }
        return GatewayFactory.instance;
    }


    getGateway(provider = config.PAYMENT_GATEWAY) {
        if (this.gatewayInstance) {
            return this.gatewayInstance;
        }

        const selectedProvider = (provider || 'razorpay').toLowerCase();

        switch (selectedProvider) {
            case 'razorpay':
                this.gatewayInstance = new RazorpayGateway(
                    config.RAZORPAY_KEY_ID,
                    config.RAZORPAY_KEY_SECRET,
                    config.RAZORPAY_WEBHOOK_SECRET
                );
                break;
            default:
                throw new Error(`Unknown payment gateway provider: ${selectedProvider}`);
        }

        return this.gatewayInstance;
    }
}

export const gatewayFactory = GatewayFactory.getInstance();
export const getGateway = () => gatewayFactory.getGateway();

export const GatewayMethod = GatewayFactory;
export default GatewayFactory;