FROM python:3.10-slim

# Create non-root user — REQUIRED by HuggingFace Spaces
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Install system dependencies
RUN pip install --no-cache-dir --upgrade pip

# Copy and install requirements first (better caching)
COPY --chown=user requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything else including data/Stocks
COPY --chown=user . /app

# Debug line — remove after confirming files are present
RUN ls /app/data/Stocks/ | head -5 && echo "DATA FILES OK"

# HuggingFace Spaces only works on port 7860
EXPOSE 7860

# Start Flask directly
CMD ["python", "main.py"]