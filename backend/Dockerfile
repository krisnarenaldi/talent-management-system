FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (untuk psycopg2, pymupdf, gosu, WeasyPrint)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    gosu \
    wget \
    curl \
    # WeasyPrint system dependencies
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-xlib-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Add entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Non-root user untuk keamanan
RUN adduser --disabled-password --gecos "" appuser
RUN mkdir -p /uploads && chown -R appuser:appuser /uploads

ENTRYPOINT ["/app/entrypoint.sh"]
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]