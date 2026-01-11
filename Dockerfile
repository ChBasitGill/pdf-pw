# Use the official Microsoft Playwright image
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Cloud Run uses the PORT environment variable (default 8080)
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]