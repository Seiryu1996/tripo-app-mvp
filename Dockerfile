FROM node:18-alpine

# OpenSSLとその他の必要なパッケージをインストール
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Prisma generate を実行
RUN npx prisma generate

EXPOSE 3000 5555

CMD ["npm", "run", "dev"]