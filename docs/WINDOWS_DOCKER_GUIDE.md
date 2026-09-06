# 🪟 Windows PC & Docker Desktop Setup Guide

> **Official Guide for Running the S2P Procurement Portal on Windows (WSL2 + Docker Desktop)**

This guide provides end-to-end instructions, optimizations, and troubleshooting steps for setting up and running the S2P Procurement Portal on a Windows machine.

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [WSL2 Resource Optimization (.wslconfig)](#2-wsl2-resource-optimization-wslconfig)
3. [Git Line Endings (CRLF vs LF)](#3-git-line-endings-crlf-vs-lf)
4. [File Paths & Environment Variables](#4-file-paths--environment-variables)
5. [Running 100% in Docker (Mode 1)](#5-running-100-in-docker-mode-1)
6. [Switching to Hybrid Mode (Mode 2)](#6-switching-to-hybrid-mode-mode-2)
7. [Common Windows Issues & Solutions](#7-common-windows-issues--solutions)

---

## 1. Prerequisites

Ensure the following tools are installed on your Windows machine:

| Tool | Minimum Version | Notes |
| :--- | :--- | :--- |
| **Windows 10 / 11** | Build 19041+ (64-bit) | WSL2 support required |
| **WSL2** | Latest | Run `wsl --update` in PowerShell |
| **Docker Desktop** | 4.30+ | Enable "Use the WSL 2 based engine" |
| **Git for Windows** | 2.40+ | Set `core.autocrlf = input` or `false` |
| **Node.js** | 20 LTS | If running frontends locally |
| **pnpm** | 9+ | Run `npm install -g pnpm` |
| **Python** | 3.14+ | If running backend locally |

---

## 2. WSL2 Resource Optimization (`.wslconfig`)

The full Docker stack runs **17 containers** (PostgreSQL, PgBouncer, Redis, RabbitMQ, MinIO, ClamAV, Jaeger, Prometheus, Grafana, Kong, Elasticsearch, FastAPI API, Celery Worker, Celery Beat, Buyer Portal, Supplier Portal, Admin Portal).

ClamAV and Next.js builds require sufficient RAM. Create or edit `C:\Users\<YourUsername>\.wslconfig`:

```ini
[wsl2]
# Allocate at least 8GB-12GB depending on total system RAM
memory=10GB

# Allocate 4 CPU cores
processors=4

# Configure swap to prevent Out-Of-Memory (OOM) kills (exit code 137)
swap=6GB
swapFile=C:\\temp\\wsl-swap.vhdx

# Enable localhost forwarding
localhostForwarding=true
```

Apply the configuration by restarting WSL in PowerShell (Run as Administrator):

```powershell
wsl --shutdown
```

---

## 3. Git Line Endings (`CRLF` vs `LF`)

Windows checkouts default to `\r\n` (CRLF), which breaks Linux containers executing shell scripts (e.g., `/entrypoint.sh: line 1: $'/bin/bash\r': no such file or directory`).

This repository includes a [`.gitattributes`](../.gitattributes) file that enforces Unix `LF` line endings automatically.

If you previously cloned the repository on Windows before `.gitattributes` was added:

```powershell
# Re-normalize repository line endings in PowerShell
git add --renormalize .
git reset --hard
```

Additionally, [`docker/Dockerfile.api`](../docker/Dockerfile.api) runs `sed -i 's/\r$//' /entrypoint.sh` during build as defense-in-depth.

---

## 4. File Paths & Environment Variables

When editing `.env` on Windows:

1. **Use forward slashes (`/`) for all paths:**
   ```dotenv
   # Correct
   JWT_PRIVATE_KEY_PATH=keys/private.pem
   JWT_PUBLIC_KEY_PATH=keys/public.pem

   # Incorrect (causes FileNotFoundError inside Linux containers)
   JWT_PRIVATE_KEY_PATH=keys\private.pem
   ```

2. **Always run docker compose commands from the project root:**
   ```powershell
   # Correct
   docker compose -f docker/docker-compose.yml up -d

   # Do not run 'docker compose up' inside the docker/ subfolder without specifying paths
   ```

---

## 5. Running 100% in Docker (Mode 1)

This mode runs the entire stack inside Docker without requiring local Python or Node dependencies.

### Step 1: Start Backing Services & Applications

```powershell
docker compose -f docker/docker-compose.yml up -d --build
```

### Step 2: Monitor API & Migrations

The `api` container automatically waits for PostgreSQL, applies all Alembic migrations, and runs idempotent seed scripts:

```powershell
docker compose -f docker/docker-compose.yml logs -f api
```

Wait until you see:
```text
Database is ready.
Running database migrations...
Seeding master data...
Seeding demo users...
Starting API server...
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 3: Access Portals

| Service | URL | Default Credentials |
| :--- | :--- | :--- |
| **Buyer Portal** | [http://localhost:3000](http://localhost:3000) | `buyer@procurement.com` / `Buyer123456!@#` |
| **Supplier Portal** | [http://localhost:3001](http://localhost:3001) | `supplier@acme.com` / `Supplier123456!@#` |
| **Admin Portal** | [http://localhost:3002](http://localhost:3002) | `admin@procurement.com` / `Admin123456!@#` |
| **API Gateway (Kong)** | [http://localhost:8000](http://localhost:8000) | Health: `/health` • Swagger: `/docs` |
| **Direct Backend API** | [http://localhost:8080](http://localhost:8080) | Direct FastAPI port |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | `minioadmin` / `minioadmin` |
| **RabbitMQ Management**| [http://localhost:15672](http://localhost:15672) | `guest` / `guest` |
| **Grafana Dashboards** | [http://localhost:3003](http://localhost:3003) | `admin` / `admin` |

---

## 6. Switching to Hybrid Mode (Mode 2)

If developing backend or frontend code locally on Windows:

1. **Stop application containers (keep backing services running):**
   ```powershell
   docker compose -f docker/docker-compose.yml stop api celery-worker celery-beat buyer-portal supplier-portal admin-portal
   ```

2. **Point Kong to your host machine:**
   ```powershell
   $env:KONG_CONFIG_PATH="../kong/kong.local.yml"
   docker compose -f docker/docker-compose.yml up -d kong
   ```

3. **Run FastAPI locally on port 8080:**
   ```powershell
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
   ```

4. **Run frontends locally:**
   ```powershell
   cd procurement-portal-frontend
   pnpm dev
   ```

---

## 7. Common Windows Issues & Solutions

### Issue A: Port Already In Use / Access Forbidden
**Error:** `bind: An attempt was made to access a socket in a way forbidden by its access permissions.`

**Root Cause:** Hyper-V or Windows WinNAT dynamically excluded the port range on boot.

**Fix:**
```powershell
# Restart WinNAT in Administrator PowerShell
net stop winnat
net start winnat
```

### Issue B: Container Exits with Code 137 (OOMKilled)
**Error:** `procurement_clamav exited with code 137` or Next.js build killed.

**Fix:** Increase swap and memory in `.wslconfig` (see Section 2), then run `wsl --shutdown`.

### Issue C: Slow File Builds on NTFS Drive (`C:\`)
**Symptom:** Next.js takes 15+ minutes to build or file-watching fails.

**Fix:** Move the repository to the native Linux filesystem inside WSL2 (e.g., `~/procurement-portal` under Ubuntu in WSL2) rather than `/mnt/c/Users/...`. Native ext4 is 10x faster than NTFS via 9P/virtiofs.
