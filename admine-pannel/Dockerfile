FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app/admine-pannel

COPY admine-pannel/package*.json ./
COPY admine-pannel/prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY common-service /app/common-service
COPY admine-pannel ./

EXPOSE 6123

ENV NODE_ENV=production
ENV PORT=6123

CMD ["node", "index.js"]
