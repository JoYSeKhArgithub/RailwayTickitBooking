FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app/user-service

COPY user-service/package*.json ./
COPY user-service/prisma ./prisma/

RUN npm install
RUN npx prisma generate
RUN npm prune --production

FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app/user-service

COPY common-service /app/common-service
COPY user-service ./
COPY --from=builder /app/user-service/node_modules ./node_modules

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "src/index.js"]
