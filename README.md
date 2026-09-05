# S2P Procurement Portal

Enterprise Source-to-Pay procurement platform built on FastAPI (backend) + Next.js 14 (frontend).

## Current Session State

**Status:** APPLE DESIGN SYSTEM: THEME SIMPLIFICATION, COMPREHENSIVE DARK MODE & HARDCODED DATA REMOVAL COMPLETE (2026-09-03)  
**Migration Head:** `0028_update_category_level_check`  
**Test Suite:** 142/142 backend unit tests passing cleanly (`pytest tests/unit/`), 100% frontend production builds passing across all 3 portals (86/86 routes compiled in 29.6s with `pnpm run build`), 0 TypeScript errors (`tsc --noEmit`).  
**Implementation Summary:**

1. **Liquid Glass Deprecation & Theme Streamlining:**
   - Completely removed Liquid Glass theme and associated CSS/TS/SVG artifacts across the monorepo per user directive.
   - Streamlined `ThemeProvider` and `ThemeSwitcher` to clean, high-performance 2-state toggle: **☀️ Light** (`apple-light`) and **🌙 Dark** (`apple-dark`).
   - Removed `<LiquidGlassBackground />`, SVG refraction filters, and liquid glass cursor trackers.
2. **Systemic Dark Mode Architecture Across All Portals & Tabs:**
   - Enabled `darkMode: 'class'` across all three Next.js applications (`admin-portal`, `buyer-portal`, `supplier-portal`).
   - Synced both `theme-apple-dark` and `dark` class tokens to `document.documentElement` to activate Tailwind `dark:` variants and CSS custom properties simultaneously.
   - Overhauled `apple-base.css` to guarantee dark mode adaptation: pure `#000000` background, elevated `#1C1C1E` card surfaces, `#2C2C2E` fills, hairline `#FFFFFF/12` borders, and high-contrast Apple SF typography.
2. **ThemeSwitcher, Universal Dark Mode & Popups/Blur:**
   - Mounted `ThemeSwitcher` (Apple segmented control: ☀️ Light / 🌙 Dark) directly into navbars of all 3 portals (`admin-portal`, `buyer-portal`, `supplier-portal`).
   - Extended `apple-base.css` and `apple-tokens.css` with unified `.dark`, `.theme-apple-dark`, and `[data-theme="apple-dark"]` selectors across all inputs, cards, selects, textareas, tables, hover states, and dynamic status badges.
   - Standardized Apple frosted glass vibrancy on all popups and modals: `backdrop-filter: blur(24px) saturate(190%)`, `-webkit-backdrop-filter`, dark translucent fills (`rgba(28, 28, 30, 0.85)`), hairline borders, and 20px radius.
   - Enforced Apple HIG pill shape (`rounded-full` / 980px) and spring micro-press (`scale(0.98)`) across primary and secondary buttons.
3. **Complete Elimination of Hardcoded Data & Account Recovery:**
   - Buyer Budgets, Buyer Catalog, Supplier Catalog, Deliveries, and Messages now exclusively use live hooks with zero hardcoded sample records.
   - Reactivated super administrator account `admin@yourcompany.com` in PostgreSQL with audit log verification.
4. **Verification:**
   - Frontend build: all 3 portals compiled & generated 86/86 static routes cleanly in 24.5s (`pnpm run build` exited with 0).
   - Backend unit suite: 142/142 tests passed in 26.08s.

**Next:** Final user walkthrough and interactive verification.

## Module Status


| Module                          | Status     | Migration                        | Tests                                     |
| ------------------------------- | ---------- | -------------------------------- | ----------------------------------------- |
| Core Scaffolding (SPEC_01)      | ✅ Complete | —                                | ✅ Unit passing                            |
| Architecture Wiring (SPEC_02)   | ✅ Complete | —                                | ✅ Unit passing                            |
| Database Schema (SPEC_03)       | ✅ Complete | 0027_data_seed                   | ✅ 28 passing                              |
| Auth / Security (SPEC_04)       | ✅ Complete | 0027_data_seed                   | ✅ 69 passing (85% cov)                    |
| Workflow Engine (SPEC_05)       | ✅ Complete | 0027_data_seed                   | ✅ Passing                                 |
| Approval Rules (SPEC_06)        | ✅ Complete | 0027_data_seed                   | ✅ Passing                                 |
| Vendor Management (SPEC_07)     | ✅ Complete | 0027_data_seed                   | ✅ 8 passing                               |
| Purchase Requisition (SPEC_08)  | ✅ Complete | 0027_data_seed                   | ✅ 9 passing                               |
| Unmapped PR (SPEC_09)           | ✅ Complete | 0027_data_seed                   | ✅ 9 passing                               |
| RFQ Lifecycle (SPEC_10)         | ✅ Complete | 0027_data_seed                   | ✅ 7 passing                               |
| Bid Management (SPEC_11)        | ✅ Complete | 0027_data_seed                   | ✅ 7 passing                               |
| Comparative Statement (SPEC_12) | ✅ Complete | 0028_update_category_level_check | ✅ 6 passing                               |
| Contract Management (SPEC_13)   | ✅ Complete | 0028_update_category_level_check | ✅ 6 passing                               |
| Purchase Order (SPEC_14)        | ✅ Complete | 0028_update_category_level_check | ✅ 6 passing                               |
| Invoice / Payment (SPEC_15)     | ✅ Complete | 0028_update_category_level_check | ✅ 6 passing                               |
| Notifications (SPEC_16)         | ✅ Complete | 0028_update_category_level_check | ✅ 9 passing                               |
| Document Management (SPEC_17)   | ✅ Complete | 0028_update_category_level_check | ✅ 9 passing                               |
| API Design Standards (SPEC_18)  | ✅ Complete | —                                | ✅ 138 passing                             |
| Frontend (SPEC_19)              | ✅ Complete | —                                | ✅ 3 portals built cleanly                 |
| Integration (SPEC_20)           | ✅ Complete | 0028_update_category_level_check | ✅ 11 passing                              |
| Infrastructure (SPEC_21)        | ✅ Complete | —                                | ✅ Manifest validation passing             |
| Observability (SPEC_22)         | ✅ Complete | —                                | ✅ Unit passing                            |
| Testing (SPEC_23)               | ✅ Complete | —                                | ✅ 229 backend / 3 frontend suites passing |
| Master Data (SPEC_24)           | ✅ Complete | 0028_update_category_level_check | ✅ Passing                                 |
| Analytics (SPEC_25)             | ✅ Complete | 0028_update_category_level_check | ✅ 6 passing                               |




## Tech Stack


| Layer            | Technology                                                            |
| ---------------- | --------------------------------------------------------------------- |
| API              | FastAPI 0.115+, Python 3.12, Uvicorn                                  |
| ORM              | SQLAlchemy 2.0 async + asyncpg                                        |
| Migrations       | Alembic (async env)                                                   |
| Queue            | RabbitMQ 3.13 via aio-pika                                            |
| Cache / Sessions | Redis 7 via redis-py async                                            |
| Object Storage   | MinIO                                                                 |
| Task Queue       | Celery 5.4 + Beat                                                     |
| Gateway          | Kong 3.6 (DB-less declarative)                                        |
| Tracing          | OpenTelemetry + Jaeger                                                |
| Metrics          | Prometheus + Grafana                                                  |
| Auth             | JWT RS256, TOTP MFA, SAML 2.0, OIDC                                   |
| Frontend         | Next.js 14 (App Router), Turborepo, TanStack Query, Zustand, Radix UI |

## Quickstart & Verification

### Mode 1: Complete Docker Stack
```bash
# Start all containers (Postgres, Redis, RabbitMQ, MinIO, Kong, API, Worker, Portals)
docker compose -f docker/docker-compose.yml up -d
```
Portals:
- Buyer Portal: http://localhost:3000
- Supplier Portal: http://localhost:3001
- Admin Portal: http://localhost:3002
- API Gateway (Kong): http://localhost:8000

### Mode 2: Local Development (Hybrid)
```bash
# 1. Start backing services only in Docker (do NOT start kong or api)
docker compose -f docker/docker-compose.yml up -d postgres redis rabbitmq minio jaeger elasticsearch

# 2. Seed data
.venv/bin/python scripts/generate_rsa_keys.py
.venv/bin/python scripts/seed_master_data.py
.venv/bin/python scripts/seed_demo_user.py

# 3. Start API backend locally on port 8000
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. Start Celery worker locally
.venv/bin/celery -A app.tasks.celery_app worker -l info

# 5. Start frontends locally
cd procurement-portal-frontend && pnpm dev
```

### Run Tests
```bash
.venv/bin/pytest tests/ -v
cd procurement-portal-frontend && pnpm typecheck
```
