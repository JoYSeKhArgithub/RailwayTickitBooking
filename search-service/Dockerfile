FROM node:20-alpine AS builder

WORKDIR /app/search-service

COPY search-service/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

FROM node:20-alpine

WORKDIR /app/search-service

COPY common-service /app/common-service
COPY search-service ./
COPY --from=builder /app/search-service/node_modules ./node_modules

EXPOSE 4002

ENV NODE_ENV=production
ENV PORT=4002

CMD ["node", "index.js"]
