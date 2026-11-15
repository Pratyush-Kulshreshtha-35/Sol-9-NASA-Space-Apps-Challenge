# ==========================================
# Stage 1: Build Frontend (Vite + React + TS)
# ==========================================
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Full-Stack Production Environment
# ==========================================
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies for astropy & pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcfitsio-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy Backend Source Code
COPY backend/ ./backend/

# Copy Pre-built Frontend Assets into /app/frontend/dist for static mounting
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose FastAPI Observatory Port
EXPOSE 8000

ENV PYTHONUNBUFFERED=1

WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
