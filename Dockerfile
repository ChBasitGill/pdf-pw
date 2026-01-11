# Use the official Microsoft Playwright image
FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app

# The playwright image comes with a 'pwuser', but for Cloud Run, 
# running as root is often simpler to avoid permission issues with GCS.
USER root

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port for Cloud Run
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]