# 🚀 Beginner's Complete Guide to Git, GitHub, Branching & CI/CD

> **Tailored specifically for the S2P Procurement Portal Project**  
> *Keep this guide handy whenever you want to make changes, push code, collaborate with teammates, or test features.*

---

## 📌 Table of Contents
1. [Core Concepts: What are Git, GitHub, and CI/CD?](#1-core-concepts-what-are-git-github-and-cicd)
2. [The Branching Strategy: Which Branch Do I Use?](#2-the-branching-strategy-which-branch-do-i-use)
3. [Who Gets What Link? (Devs, Testers, Clients)](#3-who-gets-what-link-devs-testers-clients)
4. [Step-by-Step Daily Workflow: How to Make & Merge Changes](#4-step-by-step-daily-workflow-how-to-make--merge-changes)
5. [CI/CD Explained: What Happens When You Push?](#5-cicd-explained-what-happens-when-you-push)
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

## 5. CI/CD Explained: What Happens When You Push?

In this project, our pipeline is defined in [`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml).

Every time you open a PR or push to `develop`/`main`, GitHub runs the following jobs in parallel in the cloud:

```
                      ┌───────────────────────────────────────┐
                      │            GIT PUSH / PR              │
                      └──────────────────┬────────────────────┘
                                         ▼
        ┌────────────────────────────────┬────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
┌──────────────┐                 ┌──────────────┐                 ┌──────────────┐
│  1. LINTING  │                 │ 2. BACKEND   │                 │ 3. FRONTEND  │
│              │                 │    TESTS     │                 │    TESTS     │
│ • ruff check │                 │ • Start test │                 │ • pnpm       │
│ • black      │                 │   Postgres   │                 │   typecheck  │
│ • mypy       │                 │ • Alembic    │                 │ • ESLint     │
│ • Dead code  │                 │   migrations │                 │ • Vitest     │
│   scan       │                 │ • pytest     │                 │ • Next.js    │
└───────┬──────┘                 └───────┬──────┘                 │   build      │
        │                                │                        └──────┬───────┘
        └────────────────────────────────┼───────────────────────────────┘
                                         ▼
                        ┌─────────────────────────────────┐
                        │      4. SECURITY & AUDIT        │
                        │ • Trivy container vulnerability │
                        │ • pip-audit / pnpm audit        │
                        └────────────────┬────────────────┘
                                         ▼
                        ┌─────────────────────────────────┐
                        │      ALL PASSED?  (GREEN ✅)     │
                        │ ➔ Ready to Merge & Deploy!       │
                        └─────────────────────────────────┘
```

If any step fails, GitHub blocks merging so bad code can **never** accidentally break Staging or Production.

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
