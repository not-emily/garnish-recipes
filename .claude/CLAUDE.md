# Claude Context - Garnish

This file provides context for Claude Code sessions.

## Project Overview
Garnish is a mobile-first meal planning app for households. It combines recipe management, weekly meal planning, and collaborative grocery lists. Built as a Rails API + React PWA monorepo. Self-hosted on a MacBook Pro via Cloudflare Tunnel.

## Tech Stack
- **Backend:** Ruby on Rails 8 (API-only), PostgreSQL 16, GoodJob, ActionCable
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Framer Motion
- **Auth:** Custom user model + JWT (no Devise)
- **LLM:** sage-rb (optional, user-provided API keys)
- **Hosting:** Backend on MacBook Pro (native, no Docker) via Cloudflare Tunnel. Frontend on Cloudflare Pages. Local dev on Arch Linux uses `docker-compose.yml` at the repo root to run Postgres (`docker compose up -d` → `garnish-pg` on host port 5433).
- **CI/CD:** GitHub Actions + Tailscale SSH for backend deploy

## Key Patterns & Conventions
- Monorepo: `backend/` for Rails, `frontend/` for React
- No Docker in production (Homebrew on the macOS server runs Rails + Postgres natively). On the Arch Linux dev box, Rails runs natively but Postgres runs in Docker via the root `docker-compose.yml` (host port 5433) — start it with `docker compose up -d` before `bin/rails server`.
- All API endpoints scoped to user's active household via `HouseholdScoped` concern
- Recipe ingredients/instructions stored as JSONB (not normalized tables)
- Pundit for authorization (owner/admin/member roles)
- ActionCable with async adapter (single-server, no Redis)
- GoodJob for background jobs (Postgres-backed, no Redis)
- All LLM features are optional enhancements — app must be fully functional without them

## Important Context
- This is a personal/friends-and-family app, not a commercial product
- Solo developer (Emily) building in off-hours on Arch Linux
- The MacBook Pro server is a dedicated machine (not Emily's daily driver), already running other services
- Network: Tailscale for private access, Cloudflare Tunnel for public access
- Household model: no auto-created households on signup. Users choose to create or join.
- Recipes belong to households, not users. Export available anytime + prompted on leave.
- Recipe types: full, quick_meal, event — all browsable together
- Meal slots support multiple entries
- Member grocery permissions are configurable: read, contribute (add only), full (CRUD + check-off)

## Project Structure
```
garnish/
├── backend/          # Rails 8 API-only
├── frontend/         # React + Vite PWA
├── .github/workflows/ # CI/CD
├── docs/plan/        # Project plan and phase files
└── .claude/          # Project tracking
```

## Plan & Phases
Full plan: `docs/plan/plan.md`
Phase files: `docs/plan/phases/phase-{1-10}.md`
Critical MVP path: Phase 1 → 2 → 3 → 5 → 7

## Helper Scripts
Scripts in `scripts/` are reusable helpers. **Before writing repetitive bash commands:**
1. Check if a script already exists in `scripts/`
2. If not, consider creating one for sequences you'll run again

This reduces permission prompts and ensures consistency.
