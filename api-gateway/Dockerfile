FROM node:20-alpine AS builder

WORKDIR /app/api-gateway

COPY api-gateway/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

FROM node:20-alpine

WORKDIR /app/api-gateway

COPY common-service /app/common-service
COPY api-gateway ./
COPY --from=builder /app/api-gateway/node_modules ./node_modules

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

CMD ["node", "index.js"]
