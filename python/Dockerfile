FROM mcr.microsoft.com/playwright/python:v1.49.1-jammy

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Cloud Run uses port 8080 by default
ENV PORT 8080
EXPOSE 8080

CMD ["python", "main.py"]