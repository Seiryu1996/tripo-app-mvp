FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

EXPOSE 3000 5555

CMD ["npm", "run", "dev"]