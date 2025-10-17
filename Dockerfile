# Gunakan base image Node.js versi 22 LTS
FROM node:22

# Tentukan working directory di dalam container
WORKDIR /app

# Copy file package.json dan package-lock.json terlebih dahulu
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy semua source code project ke dalam container
COPY . .

# Expose port sesuai aplikasi kamu
EXPOSE 2996

# Jalankan aplikasi
CMD ["node", "server.js"]
