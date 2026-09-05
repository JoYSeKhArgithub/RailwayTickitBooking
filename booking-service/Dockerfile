FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app/booking-service

COPY booking-service/package*.json ./
COPY booking-service/prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY common-service /app/common-service
COPY booking-service ./

EXPOSE 4008

ENV NODE_ENV=production
ENV PORT=4008

CMD ["node", "src/index.js"]
