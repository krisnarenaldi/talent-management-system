#!/bin/sh
set -e

echo "========================================="
echo "  TMS Production Deployment Script"
echo "========================================="

# Step 1: Pull latest code
echo "[1/6] Pulling latest code..."
git pull origin main

# Step 2: Rebuild backend & worker images
echo "[2/6] Building backend and worker images..."
docker compose build backend worker

# Step 3: Run database migrations
echo "[3/6] Running database migrations..."
docker compose run --rm backend alembic upgrade head

# Step 4: Restart services
echo "[4/6] Restarting services..."
docker compose up -d --force-recreate backend worker

# Step 5: Wait for services to be healthy
echo "[5/6] Waiting for services to be healthy..."
sleep 10

# Step 6: Verify deployment
echo "[6/6] Verifying deployment..."
docker compose ps

echo ""
echo "Checking backend health..."
docker exec -it tms_backend wget -qO- http://localhost:8000/health || echo "WARNING: Backend health check failed"

echo ""
echo "Checking notification table..."
docker exec -it tms_postgres psql -U "${POSTGRES_USER:-tms_user}" -d "${POSTGRES_DB:-tms_db}" -c "\dt notification" || echo "WARNING: notification table not found"

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="