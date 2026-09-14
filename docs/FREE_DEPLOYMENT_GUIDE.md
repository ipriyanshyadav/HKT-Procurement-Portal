# 🌐 Zero-Cost Deployment Guide: S2P Procurement Portal

> **How to deploy your entire Enterprise Source-to-Pay Portal (FastAPI, 3 Next.js Portals, PostgreSQL, Redis, RabbitMQ, MinIO & Celery) 100% Free Forever.**

---

## 📌 Table of Contents

1. [Understanding the Stack & Resource Requirements](#1-understanding-the-stack--resource-requirements)
2. [The 3 Free Deployment Strategies at a Glance](#2-the-3-free-deployment-strategies-at-a-glance)
3. [Strategy 1 (Recommended): Oracle Cloud Always Free VM (All-in-One Docker)](#3-strategy-1-recommended-oracle-cloud-always-free-vm-all-in-one-docker)
   - [Step 1: Create Your Always-Free Cloud VM](#step-1-create-your-always-free-cloud-vm)
   - [Step 2: Configure Firewall & Port Rules](#step-2-configure-firewall--port-rules)
   - [Step 3: Install Docker & Docker Compose](#step-3-install-docker--docker-compose)
   - [Step 4: Clone Repo, Generate Keys & Configure Environment](#step-4-clone-repo-generate-keys--configure-environment)
   - [Step 5: Launch the Entire Stack](#step-5-launch-the-entire-stack)
   - [Step 6: Free SSL & Custom Domains (Caddy / Cloudflare)](#step-6-free-ssl--custom-domains-caddy--cloudflare)
4. [Strategy 2: Distributed Serverless & PaaS (Zero Server Management)](#4-strategy-2-distributed-serverless--paas-zero-server-management)
   - [Component Mapping Table](#component-mapping-table)
   - [Deploying the 3 Next.js Portals on Vercel](#deploying-the-3-nextjs-portals-on-vercel)
   - [Provisioning Free Database (Neon.tech / Supabase)](#provisioning-free-database-neontech--supabase)
   - [Provisioning Free RabbitMQ (CloudAMQP)](#provisioning-free-rabbitmq-cloudamqp)
   - [Provisioning Free Redis (Upstash)](#provisioning-free-redis-upstash)
   - [Provisioning Free Object Storage (Cloudflare R2)](#provisioning-free-object-storage-cloudflare-r2)
   - [Deploying the FastAPI Backend (Render / Koyeb)](#deploying-the-fastapi-backend-render--koyeb)
5. [Strategy 3: Cloudflare Tunnel (Host from your Mac/PC for Free)](#5-strategy-3-cloudflare-tunnel-host-from-your-macpc-for-free)
6. [Service Comparison Matrix](#6-service-comparison-matrix)
7. [Free Tier Pitfalls & Anti-Sleep Workarounds](#7-free-tier-pitfalls--anti-sleep-workarounds)
8. [Deployment Verification Checklist](#8-deployment-verification-checklist)

---

## 1. Understanding the Stack & Resource Requirements

The S2P Procurement Portal is an enterprise-grade multi-service system:
- **3 Frontend Portals**: Buyer (`:3000`), Supplier (`:3001`), and Admin (`:3002`) built with Next.js 14 and Turborepo.
- **Backend API**: FastAPI (Python 3.14/3.12) with Uvicorn ASGI server.
- **Background Workers**: Celery Worker and Celery Beat.
- **Data & Message Infrastructure**: PostgreSQL 16, Redis 7, RabbitMQ 3.13, MinIO (S3-compatible Object Storage), and Kong API Gateway.

### Memory Footprint Breakdown

| Component | Minimum RAM Needed | Recommended RAM |
| :--- | :--- | :--- |
| **PostgreSQL 16** | 128 MB | 256 MB – 512 MB |
| **Redis 7** | 64 MB | 128 MB |
| **RabbitMQ 3.13** | 128 MB | 256 MB |
| **MinIO S3** | 128 MB | 256 MB |
| **Kong Gateway / Nginx** | 64 MB | 128 MB |
| **FastAPI Backend** | 200 MB | 512 MB |
| **Celery Worker + Beat** | 150 MB | 300 MB |
| **3 Next.js Frontends (Node)** | 300 MB (100MB each) | 600 MB (200MB each) |
| **Total Baseline Footprint** | **~1.2 GB – 1.5 GB** | **~2.5 GB – 3.0 GB** |

> ⚠️ **Why Single Traditional Free Dynos (e.g. Render 512MB free tier) Fail for the Whole Stack:**  
> If you try to run PostgreSQL + Redis + RabbitMQ + MinIO + FastAPI + Celery + 3 Next.js instances in a single 512MB free container, it will trigger an **OOM (Out Of Memory)** crash.  
> You need either:
> 1. A dedicated free VM with generous RAM (**Oracle Cloud gives 24 GB RAM for free**), OR
> 2. Splitting the services across specialized free tiers (Vercel for Next.js, Neon for Postgres, CloudAMQP for RabbitMQ, Cloudflare R2 for S3, Render/Koyeb for FastAPI).

---

## 2. The 3 Free Deployment Strategies at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               WHICH PATH TO CHOOSE?                              │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         ├──► 👑 STRATEGY 1: Oracle Cloud Always Free (Best & Most Powerful)
         │    • Gives: 4 ARM vCPUs + 24 GB RAM + 200 GB Storage ($0 forever)
         │    • Runs: Your entire existing docker-compose.yml as-is without code changes!
         │    • Ideal for: Running the real enterprise stack, background workers, and databases.
         │
         ├──► 🚀 STRATEGY 2: Distributed Serverless (No Server Management)
         │    • Frontends: Vercel (3 separate projects, instant global CDN)
         │    • Database: Neon Serverless Postgres (Postgres 16, pooled)
         │    • Message Queue: CloudAMQP (Managed RabbitMQ free tier)
         │    • Cache: Upstash Redis (Serverless Redis free tier)
         │    • Object Storage: Cloudflare R2 (10 GB free S3 storage, 0 egress fees)
         │    • Backend: Render / Koyeb (FastAPI container)
         │    • Ideal for: Git-push-to-deploy, zero Linux VM management.
         │
         └──► ⚡ STRATEGY 3: Cloudflare Tunnel (Host from your current laptop/PC)
              • Runs: Everything stays running on your Mac via docker compose
              • Gives: Free HTTPS domains (e.g., buyer.yourname.com) routed to localhost
              • Ideal for: Live client demos, investor pitch decks, portfolio review.
```

---

## 3. Strategy 1 (Recommended): Oracle Cloud Always Free VM (All-in-One Docker)

Oracle Cloud Infrastructure (OCI) has the most generous free tier in the cloud industry. Under their **Always Free** program:
- **Ampere A1 Compute**: Up to **4 OCPUs** and **24 GB of RAM** (can be 1 large VM or split into up to 4 VMs).
- **Storage**: **200 GB** free NVMe block volume storage.
- **Bandwidth**: **10 TB** outbound per month.
- **Cost**: **$0.00 / month forever**.

Your existing `docker/docker-compose.yml` can run natively on this VM with zero architecture alterations.

### Step 1: Create Your Always-Free Cloud VM

1. Go to [cloud.oracle.com](https://cloud.oracle.com) and sign up for a **Free Tier** account.
   *(Note: A valid credit/debit card is required for identity verification, but you will not be charged).*
2. Navigate to **Compute** → **Instances** → **Create Instance**.
3. Configure the VM:
   - **Image**: Ubuntu 24.04 LTS (or Ubuntu 22.04 LTS).
   - **Shape**: Change shape to **Ampere (ARM64)** → **VM.Standard.A1.Flex**.
   - Allocate: **2 to 4 OCPUs** and **12 to 24 GB RAM** (Always Free eligible).
   - **SSH Keys**: Download both the private and public keys to your computer.
4. Click **Create** and wait 60 seconds for the instance to transition to `RUNNING`. Note its **Public IP Address** (e.g. `129.150.x.x`).

### Step 2: Configure Firewall & Port Rules

Oracle Cloud requires opening ports in both the OCI Virtual Cloud Network (VCN) Security List and the local OS firewall:

1. In the OCI Console, go to your instance details → Click **Subnet** → Click **Default Security List**.
2. Click **Add Ingress Rules**:
   - **Source CIDR**: `0.0.0.0/0`
   - **Destination Port Range**: `80, 443, 3000, 3001, 3002, 8000, 8080`
   - **Protocol**: TCP
   - Click **Add Ingress Rules**.

3. SSH into your newly created VM from your local terminal:
   ```bash
   chmod 400 /path/to/ssh-key.key
   ssh -i /path/to/ssh-key.key ubuntu@<YOUR_VM_PUBLIC_IP>
   ```

4. Update the OS firewall (iptables/ufw) to allow incoming traffic:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3002 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8000 -j ACCEPT
   sudo netfilter-persistent save || sudo iptables-save | sudo tee /etc/iptables/rules.v4
   ```

### Step 3: Install Docker & Docker Compose

Run this on your Oracle Cloud Ubuntu VM:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Enable non-root docker access
sudo usermod -aG docker ubuntu
newgrp docker

# Verify Docker and Compose plugin
docker --version
docker compose version
```

### Step 4: Clone Repo, Generate Keys & Configure Environment

```bash
# 1. Clone your repository
git clone <YOUR_GITHUB_REPOSITORY_URL> procurement-portal
cd procurement-portal

# 2. Copy and set environment variables
cp .env.example .env

# 3. Generate the required 32-byte field encryption key
ENCRYPTION_KEY=$(python3 -c "import secrets, base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())")
sed -i "s/FIELD_ENCRYPTION_KEY=.*/FIELD_ENCRYPTION_KEY=${ENCRYPTION_KEY}/" .env

# 4. Generate RSA keys for JWT
mkdir -p keys
python3 scripts/generate_rsa_keys.py

# 5. Set your server IP or domain in .env
PUBLIC_IP="<YOUR_VM_PUBLIC_IP>"
sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://${PUBLIC_IP}:8000|" .env
sed -i "s|NEXT_PUBLIC_WS_URL=.*|NEXT_PUBLIC_WS_URL=ws://${PUBLIC_IP}:8000|" .env
```

### Step 5: Launch the Entire Stack

```bash
# Build and launch all containers
docker compose -f docker/docker-compose.yml up -d --build

# Run initial setup & seeding (can also be executed inside the API container)
docker compose -f docker/docker-compose.yml exec api python3 scripts/generate_rsa_keys.py
docker compose -f docker/docker-compose.yml exec api alembic upgrade head
docker compose -f docker/docker-compose.yml exec api python3 scripts/rabbitmq_setup.py
docker compose -f docker/docker-compose.yml exec api python3 scripts/minio_setup.py
docker compose -f docker/docker-compose.yml exec api python3 scripts/seed_master_data.py
docker compose -f docker/docker-compose.yml exec api python3 scripts/seed_demo_user.py
docker compose -f docker/docker-compose.yml exec api python3 scripts/seed_workflows.py
docker compose -f docker/docker-compose.yml exec api python3 scripts/seed_notification_templates.py
docker compose -f docker/docker-compose.yml exec api python3 scripts/seed_catalog_items.py
docker compose -f docker/docker-compose.yml exec api python3 scripts/seed_tickets.py
docker compose -f docker/docker-compose.yml exec api python3 scripts/create_superadmin.py
```

### Step 6: Free SSL & Custom Domains (Caddy / Cloudflare)

Instead of visiting raw IP addresses and HTTP ports (`http://<IP>:3000`), you can set up **automatic free SSL** in 3 minutes using Caddy or Cloudflare:

1. Get a free domain or subdomain (e.g. from DuckDNS.org, FreeDNS, or your own domain via Cloudflare DNS).
   Point your domain to your VM's public IP:
   - `buyer.yourdomain.com` → `<VM_IP>`
   - `supplier.yourdomain.com` → `<VM_IP>`
   - `admin.yourdomain.com` → `<VM_IP>`
   - `api.yourdomain.com` → `<VM_IP>`

2. Install **Caddy** (Automatic HTTPS reverse proxy):
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install caddy -y
   ```

3. Configure `/etc/caddy/Caddyfile`:
   ```caddyfile
   buyer.yourdomain.com {
       reverse_proxy localhost:3000
   }

   supplier.yourdomain.com {
       reverse_proxy localhost:3001
   }

   admin.yourdomain.com {
       reverse_proxy localhost:3002
   }

   api.yourdomain.com {
       reverse_proxy localhost:8000
   }
   ```

4. Reload Caddy:
   ```bash
   sudo systemctl reload caddy
   ```
   **Caddy automatically provisions free Let's Encrypt SSL certificates!** Your entire system is now live on HTTPS.

---

## 4. Strategy 2: Distributed Serverless & PaaS (Zero Server Management)

If you don't want to manage a Linux VM and prefer a pure SaaS/PaaS Git workflow where every `git push` automatically redeploys:

### Component Mapping Table

| Project Component | Free Cloud Provider | Free Tier Specification | Setup Link |
| :--- | :--- | :--- | :--- |
| **Buyer, Supplier & Admin Portals** | **Vercel** | Unlimited deployments, 100 GB bandwidth, free SSL | [vercel.com](https://vercel.com) |
| **PostgreSQL 16 Database** | **Neon.tech** | 0.5 GB storage, autoscaling serverless Postgres 16 | [neon.tech](https://neon.tech) |
| **RabbitMQ Broker** | **CloudAMQP** | 1,000,000 messages/month, 20 concurrent connections | [cloudamqp.com](https://cloudamqp.com) |
| **Redis Cache / Celery Results** | **Upstash Redis** | 10,000 requests/day, 256 MB data storage | [upstash.com](https://upstash.com) |
| **Document Storage (MinIO alternative)** | **Cloudflare R2** | 10 GB free storage, $0 egress fees, S3 compatible | [cloudflare.com/r2](https://www.cloudflare.com/developer-platform/r2/) |
| **FastAPI Backend & Workers** | **Render** or **Koyeb** | Free web service (512 MB RAM), free Docker deployment | [render.com](https://render.com) / [koyeb.com](https://koyeb.com) |

---

### Deploying the 3 Next.js Portals on Vercel

Since your frontends are organized in a Turborepo monorepo under `procurement-portal-frontend/apps/`, you create **3 separate Vercel projects** connected to the same GitHub repository:

#### Project 1: Buyer Portal
1. Go to [Vercel Dashboard](https://vercel.com/new) and import your GitHub repo.
2. Under **Root Directory**, click edit and select: `procurement-portal-frontend`.
3. Under **Framework Preset**, Next.js will be auto-detected.
4. Expand **Build and Output Settings**:
   - Build Command: `pnpm --filter buyer-portal build`
   - Output Directory: `apps/buyer-portal/.next`
   - Install Command: `pnpm install`
5. Add **Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-api.onrender.com`
   - `NEXT_PUBLIC_WS_URL`: `wss://your-backend-api.onrender.com`
6. Click **Deploy**.

#### Project 2: Supplier Portal
Repeat the same steps with:
- Build Command: `pnpm --filter supplier-portal build`
- Output Directory: `apps/supplier-portal/.next`
- Same `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`.

#### Project 3: Admin Portal
Repeat the same steps with:
- Build Command: `pnpm --filter admin-portal build`
- Output Directory: `apps/admin-portal/.next`
- Same `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`.

---

### Provisioning Free Database (Neon.tech / Supabase)

1. Sign up at [Neon.tech](https://neon.tech).
2. Create a new project:
   - Name: `procurement-portal`
   - Postgres Version: `16`
3. Copy the asyncpg connection string provided by Neon.
   Example:
   ```env
   DATABASE_URL=postgresql+asyncpg://neondb_owner:password@ep-sample-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ANALYTICS_DATABASE_URL=postgresql+asyncpg://neondb_owner:password@ep-sample-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

---

### Provisioning Free RabbitMQ (CloudAMQP)

1. Sign up at [CloudAMQP](https://customer.cloudamqp.com).
2. Click **Create New Instance**:
   - Plan: **Little Lemur (Free)**
   - Region: Select region closest to your backend (e.g. AWS us-east-1 or eu-west-1).
3. Open the instance dashboard and copy the `URL` string:
   ```env
   RABBITMQ_URL=amqps://user:password@lemur.cloudamqp.com/vhost
   CELERY_BROKER_URL=amqps://user:password@lemur.cloudamqp.com/vhost
   ```

---

### Provisioning Free Redis (Upstash)

1. Sign up at [Upstash](https://console.upstash.com).
2. Click **Create Database**:
   - Type: **Redis**
   - Plan: **Free** (10,000 commands/day)
3. Under database details, copy the standard Redis connection string:
   ```env
   REDIS_URL=rediss://default:password@us1-quick-falcon-123.upstash.io:6379
   CELERY_RESULT_BACKEND=rediss://default:password@us1-quick-falcon-123.upstash.io:6379/0
   ```

---

### Provisioning Free Object Storage (Cloudflare R2)

MinIO uses the standard Amazon S3 API. Cloudflare R2 is 100% S3 compatible and gives **10 GB storage free with $0 egress fees**:

1. Sign up at [Cloudflare](https://dash.cloudflare.com) and click **R2**.
2. Create buckets:
   - `procurement-documents`
   - `procurement-attachments`
   - `procurement-invoices`
3. Go to **Manage R2 API Tokens** → Create an API Token with **Object Read & Write** permissions.
4. Plug into your `.env`:
   ```env
   MINIO_ENDPOINT=<ACCOUNT_ID>.r2.cloudflarestorage.com
   MINIO_ACCESS_KEY=<R2_ACCESS_KEY_ID>
   MINIO_SECRET_KEY=<R2_SECRET_ACCESS_KEY>
   MINIO_SECURE=true
   ```

---

### Deploying the FastAPI Backend (Render / Koyeb)

#### Deploying on Render (Free Web Service)
1. Go to [Render.com](https://dashboard.render.com/) → Click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Settings:
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `docker/Dockerfile.api`
   - **Docker Context**: `.`
   - **Instance Type**: `Free` (512 MB RAM, 0.1 CPU)
4. Add Environment Variables:
   - `DATABASE_URL`: (from Neon)
   - `REDIS_URL`: (from Upstash)
   - `RABBITMQ_URL`: (from CloudAMQP)
   - `FIELD_ENCRYPTION_KEY`: (generated 32-byte key)
   - `SEED_ON_STARTUP`: `true` (runs migrations and seeds initial admin user on first boot)
5. Click **Create Web Service**. Render builds and gives you an HTTPS URL (e.g. `https://procurement-api.onrender.com`).

---

## 5. Strategy 3: Cloudflare Tunnel (Host from your Mac/PC for Free)

If you have a laptop, desktop, or mini-PC (like a Mac Mini or old laptop) that you keep at home, you can run the entire platform locally and expose it to the internet with **Cloudflare Tunnels** (`cloudflared`).

### Advantages:
- **Zero cost**: No cloud provider, no memory limits, no cold starts.
- **Full performance**: Uses your local machine's RAM and CPU.
- **Secure**: No port forwarding on your home router; traffic is encrypted end-to-end via Cloudflare's edge.
- **Custom domains with SSL**: Automatically gives you `https://buyer.yourdomain.com`.

### Setup in 4 Steps:

1. Install `cloudflared` on your Mac:
   ```bash
   brew install cloudflared
   ```

2. Authenticate with Cloudflare:
   ```bash
   cloudflared tunnel login
   ```

3. Create a tunnel:
   ```bash
   cloudflared tunnel create procurement
   ```

4. Configure `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <TUNNEL_UUID>
   credentials-file: /Users/<username>/.cloudflared/<TUNNEL_UUID>.json

   ingress:
     - hostname: buyer.yourdomain.com
       service: http://localhost:3000
     - hostname: supplier.yourdomain.com
       service: http://localhost:3001
     - hostname: admin.yourdomain.com
       service: http://localhost:3002
     - hostname: api.yourdomain.com
       service: http://localhost:8000
     - service: http_status:404
   ```

5. Route DNS and run:
   ```bash
   cloudflared tunnel route dns procurement buyer.yourdomain.com
   cloudflared tunnel route dns procurement supplier.yourdomain.com
   cloudflared tunnel route dns procurement admin.yourdomain.com
   cloudflared tunnel route dns procurement api.yourdomain.com

   cloudflared tunnel run procurement
   ```
Now your local Docker containers are accessible worldwide on secure HTTPS!

---

## 6. Service Comparison Matrix

| Criteria | Oracle Cloud Always Free (Strategy 1) | Distributed PaaS (Strategy 2) | Cloudflare Tunnel (Strategy 3) |
| :--- | :--- | :--- | :--- |
| **Total Monthly Cost** | **$0.00** | **$0.00** | **$0.00** |
| **Available RAM** | **Up to 24 GB** (Ampere ARM) | Varies per service | Your local RAM (8GB - 64GB) |
| **Cold Starts / Sleep** | **None** (Runs 24/7 constantly) | Yes (Render spins down after 15m) | **None** (Runs while PC is on) |
| **Background Workers** | ✅ Celery + Celery Beat native | ⚠️ Limited on free tiers | ✅ Native in Docker |
| **RabbitMQ & Redis** | ✅ Built-in Docker containers | ✅ External free SaaS | ✅ Built-in Docker containers |
| **Setup Complexity** | Low (Single Docker Compose) | Medium (Configuring 5 dashboards) | Very Low (Runs local stack) |
| **Best For** | Full production feel, clients & teams | Push-to-deploy Git workflow | Fast demo, portfolio review |

---

## 7. Free Tier Pitfalls & Anti-Sleep Workarounds

If you choose **Strategy 2 (Render/Koyeb Free Tier)**, free instances spin down ("sleep") after 15 minutes of inactivity, causing a 30-50 second cold start delay on the next visit.

### How to Keep Free Web Services Awake 24/7 for Free:
1. Sign up for a free account at [cron-job.org](https://cron-job.org) or [uptimerobot.com](https://uptimerobot.com).
2. Create a monitoring check:
   - **URL**: `https://your-backend-api.onrender.com/health`
   - **Interval**: Every 10 minutes.
3. This sends a lightweight `GET /health` request that keeps the server alive and eliminates cold starts.

---

## 8. Deployment Verification Checklist

Once deployed, verify these end-to-end sanity checks:

- [ ] **Health Endpoint**: `curl https://<your-api-url>/health` returns `{"status":"ok","version":"1.0.0"}`.
- [ ] **Database Connection**: User login succeeds via `POST /api/v1/auth/login`.
- [ ] **Frontends**:
  - [ ] Buyer Portal loads at `:3000` / `buyer.*`
  - [ ] Supplier Portal loads at `:3001` / `supplier.*`
  - [ ] Admin Portal loads at `:3002` / `admin.*`
- [ ] **Cross-Portal Persona Switcher**: Click `👑 Super Admin` header pill in any portal and switch views seamlessly.
- [ ] **WebSocket Connection**: Real-time notifications and tickets connect to `wss://<your-api-url>/ws`.
- [ ] **File Storage**: Uploading a document or requisition attachment succeeds (MinIO / Cloudflare R2).
