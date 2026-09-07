# 🚀 Beginner's Complete Guide to Git, GitHub, Branching & CI/CD

> **Tailored specifically for the S2P Procurement Portal Project**  
> *Keep this guide handy whenever you want to make changes, push code, collaborate with teammates, or test features.*

---

## 📌 Table of Contents
1. [Core Concepts: What are Git, GitHub, and CI/CD?](#1-core-concepts-what-are-git-github-and-cicd)
2. [The Branching Strategy: Which Branch Do I Use?](#2-the-branching-strategy-which-branch-do-i-use)
3. [Who Gets What Link? (Devs, Testers, Clients)](#3-who-gets-what-link-devs-testers-clients)
4. [Step-by-Step Daily Workflow: How to Make & Merge Changes](#4-step-by-step-daily-workflow-how-to-make--merge-changes)
   - [📦 Practical Runbook: How to Update Your Application & Push to GitHub](#-practical-runbook-how-to-update-your-application--push-to-github)
5. [CI/CD Explained: The 4 Pipelines & What Happens When You Push?](#5-cicd-explained-the-4-pipelines--what-happens-when-you-push)
6. [Common Mistakes to Avoid & How to Recover](#6-common-mistakes-to-avoid--how-to-recover)
7. [Daily Git Command Cheatsheet](#7-daily-git-command-cheatsheet)

---

## 1. Core Concepts: What are Git, GitHub, and CI/CD?

Think of building this project like constructing a modern commercial building:

```
┌─────────────────┐       ┌─────────────────┐       ┌────────────────────────┐
│      GIT        │  ──►  │     GITHUB      │  ──►  │         CI/CD          │
│ (Your Blueprint │       │  (Central Team  │       │   (Automated Building  │
│    Notebook)    │       │   Vault Room)   │       │   Inspectors & Cranes) │
└─────────────────┘       └─────────────────┘       └────────────────────────┘
```

- **Git (Local):** A program on your laptop that takes snapshots ("commits") of your files over time. It allows you to rewind mistakes, try experimental ideas on "branches", and track every single line changed without affecting anyone else.
- **GitHub (Cloud):** A cloud platform (website) hosting your Git repository. It lets teammates share snapshots, review each other's work via "Pull Requests", and trigger automated tools.
- **CI (Continuous Integration):** A tireless automated inspector robot. Every time you push code, GitHub spins up temporary cloud machines to check: *Does the code format properly? Are there syntax errors? Do the backend and frontend automated tests pass? Are there security vulnerabilities?*
- **CD (Continuous Delivery / Deployment):** An automated delivery robot. Once the CI inspector gives a green light (✅), CD automatically builds Docker containers and updates the live website (Staging or Production servers) with zero manual file copying.

---

## 2. The Branching Strategy: Which Branch Do I Use?

A **branch** is an independent, isolated copy of the code where you can safely experiment without breaking the working application.

Here is the exact branch structure we use for this project:

```
           [ feature/add-item-master ]  (Your private sandbox)
                 │              │
       (Branch off)       (Pull Request + CI)
                 ▼              ▼
───────────────────[ develop ]───────────────────  (Staging / Integration)
                                │
                       (Release PR + CI)
                                ▼
────────────────────[ main ]────────────────────  (Production Live Code)
                                │
                        (Tag: v1.0.0)
```

### 🌳 Branch Types & Rules:

| Branch Name | What It Is | Who Uses It? | Can You Push Directly? |
| :--- | :--- | :--- | :---: |
| **`main`** | **Production Gold Standard.** What actual users see on the real live site. | Live users & production servers. | ❌ **NEVER** |
| **`develop`** | **Integration / Staging.** The place where all new features meet and get tested together. | All developers and QA testers. | ❌ **NEVER** (Merge via PR only) |
| **`feature/<name>`** | **Your Daily Work Branch.** e.g., `feature/item-catalog` or `feature/login-fix`. | **YOU.** You create this branch, code here, and delete it once merged. | ✅ **YES** (You own it!) |
| **`fix/<name>`** | Same as a feature branch, but specifically for fixing a bug found in `develop`. | Developers fixing issues. | ✅ **YES** |
| **`hotfix/<name>`** | Emergency fix branched directly from `main` to repair a critical production crash. | Senior Dev / Lead. | ✅ (Merge to both `main` & `develop`) |

---

## 3. Who Gets What Link? (Devs, Testers, Clients)

When people ask you for a link or access, here is exactly what to give them:

### Scenario A: Another Developer working with you on the *SAME* feature
- **What to give them:** Your branch name on GitHub:  
  `https://github.com/<your-org>/procurement-portal/tree/feature/<your-feature-name>`
- **What they do:** They run in their terminal:
  ```bash
  git fetch origin
  git checkout feature/<your-feature-name>
  ```

### Scenario B: Another Developer starting their *OWN* new feature
- **What to tell them:** "Branch off `develop`."
- **What they do:**
  ```bash
  git checkout develop
  git pull origin develop
  git checkout -b feature/their-feature-name
  ```

### Scenario C: QA Engineer / Tester verifying your work
- **Option 1 (Before merge):** Send them the **Pull Request (PR) link**:  
  `https://github.com/<your-org>/procurement-portal/pull/12`  
  *(They can see what files changed and test your branch locally).*
- **Option 2 (After merge into `develop`):** Send them the **Staging Portal URL**:  
  e.g., `https://staging.buyer.yourcompany.com`  
  *(Because once code merges into `develop`, CD automatically updates Staging).*

### Scenario D: Product Manager, Executives, or Clients
- **What to give them:** The **Staging Portal URL** for demoing upcoming features, or the **Production URL** (deployed from `main`) for official business. Never give non-technical stakeholders GitHub branch links!

---

## 4. Step-by-Step Daily Workflow: How to Make & Merge Changes

> [!IMPORTANT]
> ### 📦 Practical Runbook: How to Update Your Application & Push to GitHub
>
> *(Use this quick reference box whenever you update code and want to commit and push cleanly without breaking CI/CD).*
>
> #### 1️⃣ Run Pre-Commit Quality Checks Locally
> Catch issues before pushing to prevent CI failure on GitHub:
> ```bash
> # A. Dead Code Scan (Zero raw print / console.log)
> ! grep -rn "print(" app/ | grep -v "#"
> ! grep -rn "console.log(" procurement-portal-frontend/apps/ --exclude-dir={.next,node_modules} | grep -v "#"
>
> # B. Python Syntax & Ruff Lint
> ./.venv/bin/ruff check --select E9,F63,F7,F82 app
>
> # C. Backend Unit Tests
> ./.venv/bin/pytest tests/unit/ -q
>
> # D. Frontend Typecheck & Lint (if frontend/UI changed)
> cd procurement-portal-frontend && pnpm run typecheck && pnpm run lint && cd ..
>
> # E. Knowledge Graph Update (Graphify)
> graphify update .
> ```
>
> #### 2️⃣ Review & Stage Changes
> ```bash
> # Check what was modified
> git status
> git diff
>
> # Stage files
> git add .
> ```
>
> #### 3️⃣ Commit with Project Protocol
> *Always include the `[NON-BREAKING]` or `[BREAKING]` flag:*
> ```bash
> # Format: git commit -m "[NON-BREAKING] <type>(<scope>): <message>"
> git commit -m "[NON-BREAKING] feat(sourcing): add bulk RFQ export feature"
> git commit -m "[NON-BREAKING] fix(eval,vendor): resolve undefined select in evaluation service"
> ```
>
> #### 4️⃣ Push to GitHub & Monitor CI/CD
> ```bash
> # Push to develop
> git push origin develop
> ```
> *GitHub Actions will automatically trigger the **CI Pipeline** (lint, tests, migration check, security) and **Deploy to Staging** (Docker container build).*  
> 👉 Monitor live runs at: **`https://github.com/ipriyanshyadav/HKT-Procurement-Portal/actions`**
>
> #### 5️⃣ Sync to Production (`main`)
> When `develop` is verified and green on staging:
> ```bash
> git checkout main
> git merge --ff-only develop
> git push origin main
> git checkout develop
> ```
>
> ---
> **⚡ Quick 4-Step Daily Cheat Loop:**
> ```bash
> ./.venv/bin/pytest tests/unit/ -q && graphify update .
> git add .
> git commit -m "[NON-BREAKING] <type>(<scope>): <summary>"
> git push origin develop
> ```

Follow these exact steps every single time you want to add a feature or fix a bug:

### Step 1: Start from the latest `develop` branch
Before writing a single line of code, make sure your computer has the newest version of the project:
```bash
# 1. Switch to develop
git checkout develop

# 2. Download newest changes from GitHub
git pull origin develop
```

---

### Step 2: Create your own feature branch
Give your branch a descriptive name with a prefix:
```bash
# Format: git checkout -b feature/<short-description>
git checkout -b feature/buyer-pr-filter
```
*(The `-b` flag means "create new branch and switch to it immediately").*

---

### Step 3: Write code & test locally
Make your code changes in VS Code or your IDE.  
Always test that you haven't broken existing code:
```bash
# Run backend tests
.venv/bin/pytest tests/unit/ -v

# Run frontend typecheck
cd procurement-portal-frontend && pnpm run typecheck && cd ..
```

---

### Step 4: Check what you modified
See what files you touched:
```bash
git status
```
Inspect line-by-line differences:
```bash
git diff
```

---

### Step 5: Stage and commit your changes
Save your snapshot with a clear, descriptive message:
```bash
# 1. Stage the modified files
git add app/modules/pr/services/pr_service.py procurement-portal-frontend/apps/buyer-portal/

# 2. Commit with a conventional prefix (feat, fix, refactor, test)
git commit -m "feat(pr): add status and date range filter to buyer PR dashboard [NON-BREAKING]"
```

> ⚠️ **GEMINI Rule:** Never commit commented-out code, random `print()` / `console.log()` statements, or unticketed `TODO`s!

---

### Step 6: Push your branch to GitHub
Send your branch to GitHub so others and the CI robot can see it:
```bash
git push -u origin feature/buyer-pr-filter
```
*(The `-u origin` flag links your local branch to GitHub so next time you can just type `git push`).*

---

### Step 7: Open a Pull Request (PR) on GitHub
1. Open your browser and go to your GitHub repository.
2. GitHub will show a yellow banner: **"feature/buyer-pr-filter had recent pushes — Compare & pull request"**. Click the green button!
3. **Set the Base Branch:**
   - **Base:** `develop`  *(Very important! Do NOT merge directly into main!)*
   - **Compare:** `feature/buyer-pr-filter`
4. Write a brief summary:
   - What was added or fixed.
   - Any screenshots if it's a frontend UI change.
5. Click **"Create pull request"**.

---

### Step 8: Watch the CI Robots Run (Green Checkmarks)
GitHub Actions will automatically start testing your PR:
- 🟡 *Yellow dot:* Tests are currently running.
- 🔴 *Red cross:* Something failed (a test broke, or linting failed). Click **Details** to see the error, fix it locally on your computer, commit, and `git push`. The PR updates automatically!
- 🟢 *Green checkmark:* All tests passed! Ready for review.

---

### Step 9: Merge your PR into `develop`
Once approved:
1. Click the green **"Squash and merge"** button on GitHub.
2. Confirm the merge.
3. Click **"Delete branch"** (cleans up GitHub).

---

### Step 10: Clean up your local computer
Now that your feature is part of `develop`, switch back and update:
```bash
git checkout develop
git pull origin develop
git branch -d feature/buyer-pr-filter
```

---

### 5. CI/CD Explained: The 4 Pipelines & What Happens When You Push?

In this project, automation is divided into **4 distinct pipelines** located in [`.github/workflows/`](../.github/workflows/).

Think of these 4 workflows like the **quality control and delivery stages of a car factory**:

```
[ Developer commits code ]
           │
           ▼
  1. CI Pipeline                 ──► Quality Inspector (checks engine, brakes, wiring)
           │
  (Merged into develop)
           ▼
  2. Deploy to Staging           ──► Test Track Delivery (ships car to private test track for test drivers)
           │
  (PR to main)
           ▼
  3. E2E Playwright Tests        ──► Crash & Road Test Robot (simulates a human driving the car)
           │
  (Official Release Tag v1.0.0)
           ▼
  4. Deploy to Production        ──► Showroom Delivery (delivers car to real paying customers)
```

---

### Pipeline 1: `CI Pipeline` (Continuous Integration)
**File:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)  
**When does it run?** Automatically on **every single push** or Pull Request (PR) to either `develop` or `main`.

Every time code is pushed, GitHub spins up temporary cloud containers and runs 4 parallel verification jobs:

```
                      ┌───────────────────────────────────────┐
                      │            GIT PUSH / PR              │
                      └──────────────────┬────────────────────┘
                                         ▼
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
┌──────────────┐                 ┌──────────────┐                 ┌──────────────┐
│  1. LINTING  │                 │ 2. BACKEND   │                 │ 3. FRONTEND  │
│              │                 │    TESTS     │                 │    TESTS     │
│ • Dead code  │                 │ • Start test │                 │ • pnpm       │
│   scan       │                 │   Postgres   │                 │   typecheck  │
│ • ruff check │                 │ • Generate   │                 │ • ESLint     │
│              │                 │   RSA keys   │                 │ • Next.js    │
│              │                 │ • Alembic    │                 │   build      │
│              │                 │   migrations │                 └──────┬───────┘
│              │                 │ • pytest     │                        │
└───────┬──────┘                 └───────┬──────┘                        │
        │                                │                               │
        └────────────────────────────────┼───────────────────────────────┘
                                         ▼
                        ┌─────────────────────────────────┐
                        │      4. SECURITY & AUDIT        │
                        │ • Trivy container vulnerability │
                        │ • pip-audit                     │
                        └────────────────┬────────────────┘
                                         ▼
                        ┌─────────────────────────────────┐
                        │      ALL PASSED?  (GREEN ✅)     │
                        │ ➔ Ready to Merge & Deploy!       │
                        └─────────────────────────────────┘
```

1. **Dead Code & Hygiene Scan:** Verifies no raw `print()` statements exist in backend code and no `console.log()` statements exist in frontend source code.
2. **Backend Tests & Migration Safety:**
   - Starts an isolated PostgreSQL 16 database.
   - Generates ephemeral RSA-256 JWT keys (`scripts/generate_rsa_keys.py`).
   - Tests migration rollback reversibility: runs `alembic upgrade head` -> `alembic downgrade -1` -> `alembic upgrade head` to guarantee schema migrations can be cleanly undone.
   - Runs all 367 backend unit tests with coverage reporting.
3. **Frontend Quality & Build:**
   - Runs TypeScript type checking across all packages (`pnpm run typecheck`).
   - Runs Next.js ESLint verification (`pnpm run lint`).
   - Compiles production builds of all three portals (`buyer-portal`, `supplier-portal`, `admin-portal`).
4. **Security & Vulnerability Scan:**
   - Scans dependencies for known security CVEs using `pip-audit` and the Trivy vulnerability scanner.

---

### Pipeline 2: `Deploy to Staging` (Continuous Delivery)
**File:** [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml)  
**When does it run?** Automatically whenever a completed PR is merged into the **`develop`** branch.

- **What it does:** Uses Docker Buildx to build production container images for the FastAPI backend and all three Next.js portals, preparing them for deployment to your staging environment (`staging.procurement.yourcompany.com`).
- **Why it matters:** Testers, developers, and product managers can immediately test the latest merged features in a shared, live cloud environment without anyone having to manually run deployment commands on a server.

---

### Pipeline 3: `E2E Playwright Tests` (End-to-End Browser Testing)
**File:** [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml)  
**When does it run?** On Pull Requests targeting `main` (before production release), or when manually triggered.

- **What it does:**
  - Launches headless Google Chrome browsers in the cloud.
  - Simulates a real human: logs into the Buyer Portal, creates a Purchase Requisition, switches to the Supplier Portal to submit bids, and tests the full procurement lifecycle through actual web clicks.
  - Automatically captures screenshots and reports if any button or flow fails.
- **Why it matters:** While unit tests test code logic in isolation, E2E tests prove that the entire platform (Frontend + Gateway + Backend + Database) works together harmoniously in a real browser.

---

### Pipeline 4: `Deploy to Production`
**File:** [`.github/workflows/deploy-prod.yml`](../.github/workflows/deploy-prod.yml)  
**When does it run?** Only when an official version tag is published on `main` (e.g., `v1.0.0`, `v1.1.0`), or manually triggered by an authorized administrator.

- **What it does:** Builds audited production Docker images, targets production servers, and enforces approval gating.
- **Why it matters:** Production is the live environment handling real company finances, contracts, and supplier bids. This workflow guarantees that production deployments are strictly gated, intentional, and traceable.

---

### Understanding the GitHub Actions Sidebar

When you open the **Actions** tab on GitHub:
- **`All workflows`:** Shows a combined timeline of every single pipeline run across your entire repository.
- **Clicking any specific workflow** (e.g. `CI Pipeline`, `Deploy to Staging`): Filters the list to only runs for that specific pipeline, and provides a **"Run workflow"** button to trigger it on-demand if manual dispatch is enabled.
- 🟢 **Green checkmark (Success):** All automated steps passed. Safe to merge or deploy.
- 🔴 **Red cross (Failure):** A test, lint check, or build failed. Click into the run to inspect the exact line that caused the error.

---

## 6. Common Mistakes to Avoid & How to Recover

### ❌ Mistake 1: Committing sensitive files (`.env`, `keys/private.pem`)
- **Prevention:** `.gitignore` already blocks these. Never use `git add -f .env` to force add them.
- **Rule:** If you accidentally push an API key, treat it as compromised and rotate it immediately.

### ❌ Mistake 2: Accidentally editing code directly on `main` or `develop`
- If you realize you wrote code on `develop` before creating a feature branch:
  ```bash
  # Don't panic! Create and switch to your feature branch now (your changes come with you):
  git checkout -b feature/my-new-feature
  
  # Now commit safely:
  git add .
  git commit -m "feat: my changes"
  ```

### ❌ Mistake 3: Merge Conflicts
- A merge conflict happens when two developers change the same line of the same file.
- **How to fix it:**
  ```bash
  # While on your feature branch:
  git fetch origin
  git merge origin/develop
  ```
  VS Code will highlight the conflicting lines. Choose which lines to keep, save the file, and run:
  ```bash
  git add .
  git commit -m "fix: resolve merge conflicts with develop"
  git push
  ```

---

## 7. Daily Git Command Cheatsheet

| Goal | Command |
| :--- | :--- |
| **Check current branch & modified files** | `git status` |
| **Switch to existing branch** | `git checkout <branch-name>` |
| **Create and switch to new branch** | `git checkout -b <branch-name>` |
| **Pull latest changes from GitHub** | `git pull origin <branch-name>` |
| **View changes before committing** | `git diff` |
| **Stage all changes** | `git add .` |
| **Commit staged changes** | `git commit -m "feat(module): message [NON-BREAKING]"` |
| **Push your branch to GitHub** | `git push -u origin <branch-name>` |
| **Discard local uncommitted changes to a file** | `git restore <file-path>` |
| **Delete merged local branch** | `git branch -d <branch-name>` |

---

*Need to configure the actual GitHub repository remote or setup CI/CD secrets? Refer to [README.md](file:///README.md) or ask your repository administrator.*
