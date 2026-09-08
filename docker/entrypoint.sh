#!/bin/bash
set -e

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
echo "Waiting for database connection..."
python -c "
import asyncio, sys, os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def wait_for_db():
    url = os.environ.get('DATABASE_URL')
    if not url:
        return
    engine = create_async_engine(url, pool_pre_ping=True)
    for i in range(30):
        try:
            async with engine.connect() as conn:
                await conn.execute(text('SELECT 1'))
            print('Database is ready.')
            await engine.dispose()
            return
        except Exception:
            await asyncio.sleep(1)
    print('Database connection timed out.', file=sys.stderr)
    sys.exit(1)

asyncio.run(wait_for_db())
"

echo "Generating RSA keys if needed..."
python scripts/generate_rsa_keys.py
echo "Running database migrations..."
alembic upgrade head
if [ "${SEED_ON_STARTUP:-false}" = "true" ]; then
  echo "Setting up RabbitMQ topology and MinIO buckets..."
  python scripts/rabbitmq_setup.py || true
  python scripts/minio_setup.py || true
  echo "Seeding master data..."
  python scripts/seed_master_data.py
  echo "Seeding demo users..."
  python scripts/seed_demo_user.py
  echo "Seeding workflows..."
  python scripts/seed_workflows.py
  echo "Seeding notification templates..."
  python scripts/seed_notification_templates.py
  echo "Seeding demo notifications..."
  python scripts/seed_demo_notifications.py
  echo "Seeding catalog items..."
  python scripts/seed_catalog_items.py
  echo "Seeding tickets..."
  python scripts/seed_tickets.py
  echo "Creating superadmin..."
  python scripts/create_superadmin.py
fi
echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-4}

