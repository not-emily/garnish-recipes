# Phase 1: Foundation

> **Depends on:** None
> **Enables:** All subsequent phases
>
> See: [Full Plan](../plan.md)

## Goal

Set up the monorepo, Rails API, React app shell, authentication, CI/CD pipeline, and deployment infrastructure so that a user can sign up, log in, and see a working app deployed via Cloudflare Tunnel.

## Key Deliverables

- Monorepo structure with `backend/` and `frontend/`
- Rails 8 API-only app with PostgreSQL
- React + TypeScript + Vite app with Tailwind CSS
- User authentication (signup, login, logout) with JWT tokens
- CI/CD pipeline (GitHub Actions: test on push, deploy on merge to main)
- Backend deployed natively on MacBook Pro via Cloudflare Tunnel
- Frontend deployed to Cloudflare Pages
- Branded loading screen for initial page load
- Mobile-responsive app shell with bottom navigation

## Files to Create

### Backend
- `backend/Gemfile` — Rails dependencies
- `backend/app/controllers/api/v1/auth_controller.rb` — Signup, login, logout
- `backend/app/models/user.rb` — User model (adapt existing model)
- `backend/config/routes.rb` — API routes
- `backend/config/initializers/cors.rb` — CORS configuration for CF Pages domain
- `backend/db/migrate/*_create_users.rb` — User migration (if not already present)

### Frontend
- `frontend/package.json` — React, Vite, Tailwind, TanStack Query, React Router
- `frontend/src/App.tsx` — Root component with router
- `frontend/src/api/client.ts` — API client with JWT handling
- `frontend/src/pages/Login.tsx` — Login page
- `frontend/src/pages/Signup.tsx` — Signup page
- `frontend/src/contexts/AuthContext.tsx` — Auth state management
- `frontend/src/components/layout/AppShell.tsx` — App shell with bottom nav
- `frontend/src/components/layout/BottomNav.tsx` — Mobile bottom navigation
- `frontend/src/components/layout/LoadingScreen.tsx` — Branded loading/cold-start screen
- `frontend/vite.config.ts` — Vite configuration
- `frontend/tailwind.config.js` — Tailwind configuration

### CI/CD & Deployment
- `.github/workflows/test.yml` — Run backend + frontend tests on all branches
- `.github/workflows/deploy-backend.yml` — Deploy backend on main (backend/ changes)
- `.github/workflows/deploy-frontend.yml` — Deploy frontend config (CF Pages handles build)
- `scripts/deploy-backend.sh` — Server-side deploy script (git pull, bundle, migrate, restart)

## Dependencies

**Internal:** None (this is the foundation)

**External:**
- `rails` (8.x) — API framework
- `pg` — PostgreSQL adapter
- `jwt` — JSON Web Token encoding/decoding
- `bcrypt` — Password hashing
- `rack-cors` — CORS middleware
- `pundit` — Authorization (set up, used in Phase 2+)
- `good_job` — Background job processing (set up, used in Phase 4+)
- `react` (19.x) — UI framework
- `react-router` (7.x) — Client-side routing
- `@tanstack/react-query` — Server state management
- `tailwindcss` (4.x) — Utility-first CSS
- `vite` — Build tool

## Implementation Notes

### JWT Authentication Strategy
- Use a custom JWT implementation (no Devise). The user has an existing user model to adapt.
- Access tokens are short-lived (15 min). Refresh tokens are long-lived (30 days) and stored in httpOnly cookies.
- The API client in React should handle transparent token refresh on 401 responses.

### CORS Configuration
- Allow requests from the CF Pages domain (e.g., `garnish.yourdomain.com`)
- Allow credentials (for httpOnly cookies carrying refresh tokens)
- Allow WebSocket upgrade headers (for ActionCable in later phases)

### App Shell Design
- Bottom navigation with 4 tabs: Recipes, Meal Plan, Grocery List, Settings
- The shell should feel like a native app — no browser chrome visible when installed as PWA
- Loading screen shows the garnish logo/brand while the API wakes up or the app hydrates

### Deployment Setup
- MacBook Pro: Install Ruby (rbenv), PostgreSQL (Homebrew), cloudflared (Homebrew)
- Configure cloudflared tunnel to route `api.garnish.yourdomain.com` to `localhost:3000`
- Configure CF Pages to build from `frontend/` directory
- Tailscale GitHub Action for CI/CD SSH access with ephemeral auth key

### Development Environment
- Arch Linux local development
- `foreman` or `overmind` to run Rails + Vite dev servers together
- Procfile.dev for local development

## Validation

How do we know this phase is complete?

- [ ] `backend/` contains a working Rails 8 API app with PostgreSQL
- [ ] `frontend/` contains a working React + Vite app with Tailwind
- [ ] A user can sign up, log in, and see an authenticated home screen
- [ ] JWT access/refresh token flow works correctly
- [ ] App shell renders with bottom navigation on mobile
- [ ] Loading screen displays during initial load
- [ ] GitHub Actions runs tests on push to any branch
- [ ] Pushing to main auto-deploys frontend to CF Pages
- [ ] Pushing to main auto-deploys backend to MacBook via Tailscale SSH
- [ ] The app is accessible at the public CF Tunnel URL
- [ ] CORS is configured correctly between frontend and backend domains
