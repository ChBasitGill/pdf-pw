# Use the official stable tag without the 'v' prefix
FROM mcr.microsoft.com/playwright:1.57.0-noble

WORKDIR /app

# Ensure we run as root to access browser binaries if needed
USER root

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080
CMD ["node", "server.js"]