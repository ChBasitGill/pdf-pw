# Updated to match the version required by the library
FROM mcr.microsoft.com/playwright:v1.57.0-focal

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080
CMD ["node", "server.js"]