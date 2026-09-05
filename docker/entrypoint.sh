#!/bin/bash
set -e

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "Running database migrations..."
alembic upgrade head
echo "Seeding master data..."
python scripts/seed_master_data.py
echo "Seeding demo users..."
python scripts/seed_demo_user.py
echo "Seeding notification templates..."
python scripts/seed_notification_templates.py
echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-4}

