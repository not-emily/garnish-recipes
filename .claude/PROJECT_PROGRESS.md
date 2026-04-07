# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-4.md](../docs/plan/phases/phase-4.md)
Latest Weekly Report: None
Latest Daily Report: [daily-2026-04-06.md](../docs/reports/daily-2026-04-06.md)

Last Updated: 2026-04-06

## Current Focus
Phase 3 complete. Recipe management is fully functional. Ready to begin Phase 4: Recipe Ingestion.

## Active Tasks
- [NEXT] Phase 4: Recipe Ingestion — URL/PDF/image import with optional LLM enhancement
  - ⏭ URL import with JSON-LD/Schema.org recipe extraction
  - ⏭ PDF import with text extraction
  - ⏭ Image import (with attachment storage)
  - ⏭ LLM-powered extraction via sage-rb (optional, user-provided keys)
  - ⏭ Background job processing with status updates
  - ⏭ Encrypted user API key storage
  - ⏭ Import UI with progress indicators
  - ⏭ Fallback flow: store source material as attachment, manual entry

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
- [2026-04-06] Phase 2: Households
  - Household model with auto-generated invite codes (food-themed: SAUTE-SAGE-84)
  - HouseholdMembership model with roles (owner/admin/member) and grocery permissions (read/contribute/full)
  - User associations: active_household, membership_for
  - Current attributes for request-scoped household context
  - HouseholdScoped concern for auto-scoping controllers
  - HouseholdPolicy and MembershipPolicy (advanced policy pattern)
  - Households controller: create, join, show, update, regenerate invite
  - Memberships controller: list, update role/permissions, remove
  - Frontend HouseholdContext for active household state
  - Onboarding page (create or join household)
  - Route guards: unauth → login, no household → onboarding, has household → app
  - InviteFlow component with copy + regenerate buttons
  - HouseholdSettings (name, diners, leftover preferences)
  - MemberList with role/permission management
  - Settings page with all household management sections
- [2026-04-06] Auth/session layer audit and refactor
  - Ran project-auditor agent for deep review of auth layer
  - Audit verdict: B-, sound architecture, polish needed
  - Added apikey column to User (urlsafe_base64, backfilled, exposed as `id` in API)
  - Refactored refresh token format: <apikey>.<random>, single cookie (dropped refresh_user_id)
  - JWT payload uses user_apikey + type validation (defense in depth)
  - Extracted shared cookie_options helper (set + clear use same attributes)
  - Added COOKIE_DOMAIN env var for production cross-subdomain support
  - Fixed clear_refresh_cookie to mirror SameSite=None; Secure (Safari logout bug)
  - JWT_SECRET length validation (32+ chars)
  - Fixed HouseholdContext race condition (waits for authLoading to settle)
  - Frontend client.ts: setSessionExpiredHandler triggers clean logout on refresh failure
  - Fixed refreshPromise deduplication bug (was being nulled before await resolved)
  - Extracted useSessionLoading hook for unified route guard loading state
  - Set up minitest, wrote 17 auth tests covering signup/login/refresh/logout/type validation
  - Caught and fixed separator collision: _ in apikey conflicted with _ as token separator (now uses .)
- [2026-04-06] Phase 3: Recipes Core
  - Recipe model with JSONB ingredient_groups + instructions, apikey-as-id
  - Validations: structure validation for JSONB fields, full-recipe required fields
  - Scopes: search, by_category, by_cuisine, by_protein, by_difficulty, by_type, with_tags, max_total_time
  - RecipePolicy with structured action methods + nested Scope class for index queries
  - policy_scope helper added to ApplicationController (basic policy pattern from code-ref)
  - RecipesController with full CRUD + filtering + sorting + search
  - 20 backend controller tests covering CRUD, authorization, household scoping, search/filter
  - Recipe TypeScript types and API client with query string builder
  - RecipeBrowser component: search input, type chips, category chips, responsive grid
  - Smart filter chips: only show types/categories that actually exist in the household
  - RecipeCard with image fallback, type badge, time/servings info, animated mount
  - RecipeDetail page: hero, taxonomy chips, ingredient sections, numbered instructions with timers, edit/export/delete
  - RecipeNew with type selector (Recipe / Quick Meal / Event)
  - RecipeEdit reusing the same form
  - RecipeForm adapts to recipe_type with conditional fields
  - IngredientEditor: structured rows with sections, up/down reordering, qty/unit/name/prep
  - InstructionEditor: numbered steps with optional timers, up/down reordering
  - Single recipe export as JSON via download button
  - Quick meals support optional servings (for leftover tracking)

## Next Session
Begin Phase 4: Recipe Ingestion — start with URL JSON-LD parsing (free, no LLM needed), then add the background job infrastructure for PDF/image with sage-rb integration.
