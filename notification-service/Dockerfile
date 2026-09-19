FROM node:20-alpine AS builder

WORKDIR /app/notification-service

COPY notification-service/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

FROM node:20-alpine

WORKDIR /app/notification-service

COPY common-service /app/common-service
COPY notification-service ./
COPY --from=builder /app/notification-service/node_modules ./node_modules

EXPOSE 4004

ENV NODE_ENV=production
ENV PORT=4004

CMD ["node", "src/index.js"]
