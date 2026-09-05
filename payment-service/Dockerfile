FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app/payment-service

COPY payment-service/package*.json ./
COPY payment-service/prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY common-service /app/common-service
COPY payment-service ./

EXPOSE 4011

ENV NODE_ENV=production
ENV PORT=4011

CMD ["node", "src/index.js"]
