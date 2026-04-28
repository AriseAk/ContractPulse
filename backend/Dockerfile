FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (needed for pandas, prophet, etc.)
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy backend code
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose HF required port
EXPOSE 7860

# Start app
CMD ["python", "main.py"]