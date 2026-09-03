# SPEC_21_INFRASTRUCTURE.md

## Title
Enterprise S2P Procurement Portal — Infrastructure & Deployment

## Purpose
Define K3s deployment, Docker configuration, CI/CD pipeline, HA setup for all stateful services, blue-green deployment, DR strategy, and all operational procedures.

## Scope
Covers K3s cluster topology, Dockerfiles, docker-compose, K3s manifests, Kong deployment, GitHub Actions CI/CD, blue-green deployment, PostgreSQL HA (Patroni), Redis Sentinel, RabbitMQ cluster, MinIO distributed, observability stack deployment, Grafana alerts, DR strategy, and environment specifications.

## Dependencies
- SPEC_02_ARCHITECTURE.md (service registry, Celery queues)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. K3s Cluster Topology

**Production:**
- Control plane: 3 nodes (HA with embedded etcd)
- Worker nodes: 3 minimum
- Node sizing: 8 vCPU, 32GB RAM, 200GB SSD per worker

**Staging:** 3-node cluster (mirrors production topology, smaller instances)
**Dev:** Single K3s node

## 2. Docker Configuration

### API Dockerfile (Multi-stage)

```dockerfile
# docker/Dockerfile.api
FROM python:3.14-slim-bookworm AS builder
WORKDIR /build
COPY pyproject.toml requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.14-slim-bookworm AS runtime
WORKDIR /app
COPY --from=builder /install /usr/local
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./
EXPOSE 8000
CMD ["gunicorn", "app.main:create_app()", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000", "--timeout", "120"]
```

### Celery Worker Dockerfile

```dockerfile
# docker/Dockerfile.celery
FROM python:3.14-slim-bookworm
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
CMD ["celery", "-A", "app.tasks.celery_app", "worker", "-l", "info", "-Q", "celery.notification,celery.integration,celery.sla_timers,celery.outbox,celery.analytics,celery.document"]
```

### docker-compose.yml (Local Development)

```yaml
version: "3.9"
services:
  api:
    build: { dockerfile: docker/Dockerfile.api }
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [postgres, redis, rabbitmq, minio]

  celery-worker:
    build: { dockerfile: docker/Dockerfile.celery }
    env_file: .env
    depends_on: [postgres, redis, rabbitmq]

  celery-beat:
    build: { dockerfile: docker/Dockerfile.celery }
    command: celery -A app.tasks.celery_app beat -l info
    env_file: .env

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: procurement
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: dev_password
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  rabbitmq:
    image: rabbitmq:3.13-management
    ports: ["5672:5672", "15672:15672"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    volumes: ["miniodata:/data"]

  elasticsearch:
    image: elasticsearch:8.14.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports: ["9200:9200"]

volumes:
  pgdata:
  miniodata:
```

## 3. K3s Manifests (Helm Chart Structure)

```
k8s/
├── base/
│   ├── namespace.yaml           # procurement-portal
│   ├── api-deployment.yaml      # FastAPI (3 replicas)
│   ├── celery-worker-deployment.yaml  # Celery workers (2 replicas)
│   ├── celery-beat-deployment.yaml    # Celery Beat (1 replica)
│   ├── buyer-portal-deployment.yaml   # Next.js (2 replicas)
│   ├── supplier-portal-deployment.yaml
│   ├── admin-portal-deployment.yaml
│   ├── postgres-statefulset.yaml      # Patroni (3 replicas)
│   ├── redis-statefulset.yaml         # Sentinel (3 replicas)
│   ├── rabbitmq-statefulset.yaml      # Cluster (3 replicas)
│   ├── minio-statefulset.yaml         # Distributed (4 replicas)
│   ├── elasticsearch-statefulset.yaml
│   ├── kong-deployment.yaml
│   ├── services.yaml
│   ├── ingress.yaml              # Traefik ingress
│   ├── configmaps.yaml
│   └── sealed-secrets.yaml       # Sealed Secrets operator
└── overlays/
    ├── dev/
    │   └── kustomization.yaml    # 1 replica each, smaller resources
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        └── kustomization.yaml    # Full replicas, production resources
```

## 4. Kong Deployment

DB-less (declarative) mode. Kong Ingress Controller deployed as K3s DaemonSet. Configuration via `KongIngress` CRD resources. See SPEC_02 Section 10 for full `kong.yml`.

## 5. GitHub Actions CI/CD

### ci.yml (Every Push)

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install ruff mypy
      - run: ruff check app/
      - run: mypy app/ --strict

  test:
    runs-on: ubuntu-latest
    services:
      postgres: { image: "postgres:16", env: {...} }
      redis: { image: "redis:7" }
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt -r requirements-test.txt
      - run: pytest tests/unit/ -v --cov=app --cov-report=xml
      - run: pytest tests/integration/ -v

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f docker/Dockerfile.api -t procurement-api:${{ github.sha }} .
      - run: docker build -f docker/Dockerfile.celery -t procurement-celery:${{ github.sha }} .

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: trivy image procurement-api:${{ github.sha }}
      - run: snyk test --all-projects
```

### deploy-staging.yml (Auto on main merge)

Builds images → pushes to registry → applies K3s manifests to staging namespace → runs smoke tests.

### deploy-production.yml (Manual with approval)

Requires GitHub Environment approval. Blue-green deployment. Smoke test before traffic switch. Rollback < 2 minutes.

## 6. Blue-Green Deployment

Two K3s namespaces: `procurement-blue` and `procurement-green`. Active namespace serves traffic. Deploy to inactive namespace → run smoke test suite → `kubectl patch service` to switch selector → monitor for 5 minutes → if issues, rollback by reverting selector.

## 7. PostgreSQL HA (Patroni)

3-node cluster: 1 leader + 2 replicas. Patroni with etcd for leader election. Streaming replication. PgBouncer connection pooler (transaction mode, pool_size 50). Backup: `pgBackRest` to MinIO daily full + hourly incremental. WAL archiving to MinIO.

## 8. Redis Sentinel

3-node configuration: 1 master + 2 replicas + 3 Sentinel processes. Automatic failover. K8s headless service for Sentinel discovery.

## 9. RabbitMQ Cluster

3-node mirrored queues. Management plugin enabled. Vhost: `procurement`. User: `app_user` with permissions limited to `procurement` vhost.

## 10. MinIO Distributed

4-node MinIO with erasure coding (2+2). HTTPS with TLS. MinIO Console for admin. Lifecycle rules per bucket. Audit logging to Loki.

## 11. Observability Stack Deployment

- **Prometheus:** Scrapes FastAPI `/metrics`, K3s node metrics, PostgreSQL exporter, Redis exporter, RabbitMQ exporter, MinIO
- **Grafana:** Dashboards: App Overview, DB Performance, Queue Depth, API Latency, Error Rates, Procurement KPIs
- **Loki:** Via Promtail DaemonSet on all nodes
- **Jaeger:** All-in-one for Phase 1; separate collector/query in Phase 2
- **Uptime Kuma:** Monitors all external endpoints + internal services

## 12. Grafana Alerts

| Alert | Expression | Duration | Severity |
|---|---|---|---|
| HighAPILatency | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2` | 5 min | critical |
| HighErrorRate | `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01` | 5 min | critical |
| DBConnectionPoolExhausted | `pgbouncer_pools_server_active / pgbouncer_pools_server_total > 0.9` | 2 min | critical |
| RabbitMQQueueDepth | `rabbitmq_queue_messages > 1000` | 15 min | warning |
| RedisMemoryHigh | `redis_memory_used_bytes / redis_memory_max_bytes > 0.8` | 10 min | warning |
| CeleryWorkerDown | `celery_workers_active == 0` | 2 min | critical |
| SLABreachAccumulating | `increase(workflow_sla_breach_total[1h]) > 10` | instant | critical |
| MinIODiskUsageHigh | `minio_disk_used_bytes / minio_disk_total_bytes > 0.85` | 10 min | warning |
| IntegrationJobFailureRate | `increase(integration_job_failure_total[30m]) > 5` | instant | warning |

## 13. DR Strategy

Secondary K3s cluster (cold standby). PostgreSQL WAL shipping to secondary MinIO. RTO: 4 hours. DNS failover via health-check-based TTL (60s). DR drill schedule: monthly restore test, quarterly full exercise.

## 14. Environments Table

| Environment | Nodes | CPU/Node | RAM/Node | Deploy Frequency | Data Policy |
|---|---|---|---|---|---|
| Local | docker-compose | Host | Host | On save | Seed data |
| Dev | 1 K3s | 4 vCPU | 16 GB | On develop merge | Anonymized subset |
| Staging | 3 K3s | 4 vCPU | 16 GB | On main merge | Anonymized clone |
| Production | 3+ K3s | 8 vCPU | 32 GB | Manual + approval | Production |
| DR | 3 K3s | 8 vCPU | 32 GB | WAL shipping | Replica |
