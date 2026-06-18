FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

ENV PORT=8080
EXPOSE 8080

# Run with least privilege user
USER node

CMD ["node", "src/index.js"]
