FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app/inventory-service

COPY inventory-service/package*.json ./
COPY inventory-service/prisma ./prisma/

RUN npm install
RUN npx prisma generate
RUN npm prune --production

FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app/inventory-service

COPY common-service /app/common-service
COPY inventory-service ./
COPY --from=builder /app/inventory-service/node_modules ./node_modules

EXPOSE 4005

ENV NODE_ENV=production
ENV PORT=4005

CMD ["node", "src/index.js"]
