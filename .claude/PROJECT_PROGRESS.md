# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-2.md](../docs/plan/phases/phase-2.md)
Latest Weekly Report: None

Last Updated: 2026-04-06

## Current Focus
Phase 1 complete. Ready to begin Phase 2: Households.

## Active Tasks
- [NEXT] Phase 2: Households — multi-tenancy, roles, onboarding
  - ⏭ Household model and migrations
  - ⏭ HouseholdMembership model with roles (owner/admin/member)
  - ⏭ Household CRUD controller + settings
  - ⏭ Invite system (invite codes, join flow)
  - ⏭ Post-signup onboarding (create or join household)
  - ⏭ HouseholdScoped concern for controller scoping
  - ⏭ Authorization policies for household actions
  - ⏭ Frontend: onboarding flow, household settings, member management

## Open Questions/Blockers
None

## Completed This Week
- [2026-04-06] Project architecture planning
  - Defined core vision, requirements, and constraints
  - Designed household/multi-tenancy model
  - Designed recipe model with JSONB ingredients/instructions
  - Designed meal planning with multiple entries per slot, leftovers, quick meals, events
  - Designed grocery list generation with source tracking and real-time sync
  - Designed role-based permissions (owner/admin/member)
  - Chose tech stack: Rails 8 API + React PWA + PostgreSQL
  - Decided on self-hosting via Cloudflare Tunnel (no Docker)
  - Created plan.md and 10 phase files
- [2026-04-06] Phase 1: Foundation
  - Rails 8 API-only app with PostgreSQL (Docker Compose on port 5433)
  - User model with has_secure_password
  - JWT auth: access tokens (15min) + refresh tokens (30-day, httpOnly cookie)
  - Auth controller: signup, login, refresh, logout, me
  - Advanced policy authorization pattern (structured results with reason codes)
  - Figaro for credential management (application.yml)
  - CORS configured for frontend origin
  - React 19 + TypeScript + Vite + Tailwind CSS 4
  - TanStack Query, React Router 7, Framer Motion, Lucide icons
  - API client with automatic JWT refresh on 401
  - AuthContext with session restore on mount
  - Login & Signup pages
  - App shell with bottom nav (Recipes, Meal Plan, Grocery, Settings)
  - Branded loading screen
  - Protected/public route guards
  - GitHub Actions: test workflow + backend deploy via Tailscale SSH
  - Procfile.dev for local development (foreman)
  - Deploy script (scripts/deploy-backend.sh)

## Next Session
Begin Phase 2: Households — start with backend models, migrations, and the household scoping concern.
