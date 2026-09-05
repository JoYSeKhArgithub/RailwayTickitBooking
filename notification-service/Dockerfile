FROM node:20-alpine

WORKDIR /app/notification-service

COPY notification-service/package*.json ./
RUN npm install --omit=dev

COPY common-service /app/common-service
COPY notification-service ./

EXPOSE 4004

ENV NODE_ENV=production
ENV PORT=4004

CMD ["node", "src/index.js"]
