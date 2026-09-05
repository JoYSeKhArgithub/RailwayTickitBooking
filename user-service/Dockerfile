FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app/user-service

COPY user-service/package*.json ./
COPY user-service/prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY common-service /app/common-service
COPY user-service ./

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "src/index.js"]
