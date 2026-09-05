import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serviceName = 'notification-service';
try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name) {
            serviceName = pkg.name;
        }
    }
} catch {
    serviceName = 'notification-service';
}

export const config = {
    SERVICE_NAME: serviceName,
    PORT: Number(process.env.PORT) || 4004,
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*',
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9093',
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'notification-service',
    MAIL_SEND: process.env.MAIL_SEND,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
};

export default config;
