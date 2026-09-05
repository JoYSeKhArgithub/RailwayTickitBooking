FROM node:20-alpine

WORKDIR /app/search-service

COPY search-service/package*.json ./
RUN npm install --omit=dev

COPY common-service /app/common-service
COPY search-service ./

EXPOSE 4002

ENV NODE_ENV=production
ENV PORT=4002

CMD ["node", "index.js"]
