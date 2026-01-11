FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app
USER root

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080
CMD ["node", "server.js"]