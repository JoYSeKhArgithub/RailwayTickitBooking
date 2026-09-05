FROM node:20-alpine

WORKDIR /app/api-gateway

COPY api-gateway/package*.json ./
RUN npm install --omit=dev

COPY common-service /app/common-service
COPY api-gateway ./

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

CMD ["node", "index.js"]
