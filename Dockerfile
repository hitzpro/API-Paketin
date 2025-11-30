# Gunakan Node.js versi ringan
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy semua kode
COPY . .

# Expose port
EXPOSE 3200

# Jalankan server
CMD ["node", "server.js"]