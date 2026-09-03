#!/bin/bash
set -e
echo "Running database migrations..."
alembic upgrade head
echo "Seeding master data..."
python scripts/seed_master_data.py
echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-4}
