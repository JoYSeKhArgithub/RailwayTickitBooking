FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app/admine-pannel

COPY admine-pannel/package*.json ./
COPY admine-pannel/prisma ./prisma/

RUN npm install
RUN npx prisma generate
RUN npm prune --production

FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app/admine-pannel

COPY common-service /app/common-service
COPY admine-pannel ./
COPY --from=builder /app/admine-pannel/node_modules ./node_modules

EXPOSE 6123

ENV NODE_ENV=production
ENV PORT=6123

CMD ["node", "index.js"]
