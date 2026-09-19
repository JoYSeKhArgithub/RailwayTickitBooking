FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app/payment-service

COPY payment-service/package*.json ./
COPY payment-service/prisma ./prisma/

RUN npm install
RUN npx prisma generate
RUN npm prune --production

FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app/payment-service

COPY common-service /app/common-service
COPY payment-service ./
COPY --from=builder /app/payment-service/node_modules ./node_modules

EXPOSE 4011

ENV NODE_ENV=production
ENV PORT=4011

CMD ["node", "src/index.js"]
