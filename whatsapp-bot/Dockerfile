# Dockerfile for WhatsApp Bot
FROM node:18-slim

WORKDIR /app

# Salin package.json dan package-lock.json
COPY package*.json ./

# Instal dependensi
RUN npm install

# Salin sisa kode aplikasi
COPY . .

# Jalankan bot
CMD ["node", "index.js"]
