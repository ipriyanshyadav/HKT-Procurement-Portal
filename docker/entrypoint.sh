#!/bin/bash
set -euo pipefail

# ─── Allow direct command override (e.g. celery worker/beat) ─────────────────
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# ─── Wait for database readiness ──────────────────────────────────────────────
echo "[entrypoint] Waiting for database connection..."
python - <<'PYEOF'
import asyncio, sys, os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def wait_for_db():
    url = os.environ.get('DATABASE_URL')
    if not url:
        print('[entrypoint] DATABASE_URL not set — skipping DB wait.', file=sys.stderr)
        return
    engine = create_async_engine(
        url,
        pool_pre_ping=True,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    for attempt in range(60):
        try:
            async with engine.connect() as conn:
                await conn.execute(text('SELECT 1'))
            await engine.dispose()
            print(f'[entrypoint] Database ready after {attempt + 1} attempt(s).')
            return
        except Exception as exc:
            print(f'[entrypoint] Waiting for DB (attempt {attempt + 1}/60): {exc}', file=sys.stderr)
            await asyncio.sleep(2)
    print('[entrypoint] Database connection timed out after 120s.', file=sys.stderr)
    sys.exit(1)

asyncio.run(wait_for_db())
PYEOF

# ─── Generate RSA keys (idempotent) ──────────────────────────────────────────
echo "[entrypoint] Generating RSA keys if needed..."
python scripts/generate_rsa_keys.py

# ─── Run Alembic migrations ──────────────────────────────────────────────────
echo "[entrypoint] Running database migrations..."
alembic upgrade head

# ─── Optional: seed data (controlled by SEED_ON_STARTUP env) ─────────────────
if [ "${SEED_ON_STARTUP:-false}" = "true" ]; then
  echo "[entrypoint] Setting up RabbitMQ topology and MinIO buckets..."
  python scripts/rabbitmq_setup.py || true
  python scripts/minio_setup.py || true

  echo "[entrypoint] Seeding master data..."
  python scripts/seed_master_data.py

  echo "[entrypoint] Seeding demo users..."
  python scripts/seed_demo_user.py

  echo "[entrypoint] Seeding workflows..."
  python scripts/seed_workflows.py

  echo "[entrypoint] Seeding notification templates..."
  python scripts/seed_notification_templates.py

  echo "[entrypoint] Seeding demo notifications..."
  python scripts/seed_demo_notifications.py

  echo "[entrypoint] Seeding catalog items..."
  python scripts/seed_catalog_items.py

  echo "[entrypoint] Seeding tickets..."
  python scripts/seed_tickets.py

  echo "[entrypoint] Creating superadmin..."
  python scripts/create_superadmin.py
fi

# ─── Start API server ─────────────────────────────────────────────────────────
WORKERS="${UVICORN_WORKERS:-4}"
echo "[entrypoint] Starting API server with ${WORKERS} worker(s)..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${WORKERS}" \
  --loop uvloop \
  --http httptools \
  --proxy-headers \
  --forwarded-allow-ips '*'
