# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-4.md](../docs/plan/phases/phase-4.md)
Latest Weekly Report: None
Latest Daily Report: [daily-2026-04-06.md](../docs/reports/daily-2026-04-06.md)

Last Updated: 2026-04-07

## Current Focus
Phase 4: Recipe Ingestion — Sub-phase A (URL gold path) is complete and working end-to-end. Three extractors layered (JSON-LD, microdata, Open Graph), background job pipeline shipped, frontend import flow shipped with progress + needs-review banners. Sub-phase B (LLM/PDF/image/attachments/API key UI) still pending.

## Active Tasks
- [IN PROGRESS] Phase 4: Recipe Ingestion
  - ✓ Sub-phase A: URL gold path (JSON-LD + microdata + Open Graph fallback)
    - ✓ import_status enum migration + relaxed validations for imports
    - ✓ RecipeIngestion::UrlParser with SSRF guards, redirect cap, retry-on-timeout, browser UA
    - ✓ RecipeIngestion::JsonLdExtractor (top-level, @graph, arrays, multi-script, @type arrays)
    - ✓ RecipeIngestion::MicrodataExtractor (Schema.org HTML5 microdata, nested HowToStep handling)
    - ✓ RecipeIngestion::OpenGraphExtractor (last-resort title/description/image)
    - ✓ RecipeIngestion::Normalizer (Schema.org → Recipe attrs, ISO 8601 durations incl. P0DT0H20M0S, freeform recipeYield, category mapping, HowToSection flattening, totalTime)
    - ✓ RecipeIngestion::UrlIngester orchestrator with three-extractor cascade
    - ✓ RecipeIngestionJob (GoodJob async, fail-with-message, fallback title for failed/needs_review)
    - ✓ Api::V1::ImportsController (POST /imports + GET /imports/:apikey for polling)
    - ✓ RecipesController#index excludes importing drafts via IS DISTINCT FROM
    - ✓ Frontend ImportModal (bottom-sheet on mobile, focus management, Esc-to-close)
    - ✓ Frontend ImportProgress (polls 1.5s, invalidates parent on completion, error card for failed)
    - ✓ Frontend RecipeDetail short-circuits to ImportProgress for importing/failed states
    - ✓ Frontend RecipeDetail needs_review banner (amber, calls user to edit)
    - ✓ Frontend RecipeCard defensive null-title handling
    - ✓ Frontend Recipes page Import button (admin/owner only)
    - ✓ 54 new backend tests (JsonLdExtractor, Normalizer, MicrodataExtractor, OpenGraphExtractor, RecipeIngestionJob, ImportsController) — 91/91 total passing
  - ⏭ Sub-phase B: LLM extraction + attachments + PDF/image + API key UI
    - ⏭ Encrypted user LLM API key storage (Rails 8 encrypts)
    - ⏭ ActiveStorage + Cloudflare R2 for source attachments
    - ⏭ PDF ingestion path (pdf-reader + sage-rb extraction)
    - ⏭ Image ingestion path (sage-rb vision)
    - ⏭ sage-rb wrapper using fresh Configuration per-user (no global state)
    - ⏭ Frontend Settings ApiKeyForm (provider + key + model)
    - ⏭ Frontend ImportModal PDF/image tabs

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
- [2026-04-07] Phase 4 sub-phase A: URL recipe import (gold path)
  - Migration: import_status enum (importing/complete/needs_review/failed), import_source_type, import_error, import_completed_at; title now nullable
  - Recipe model: enum + import_in_progress? predicate, validations relaxed for imports (full_recipe_required_fields skipped when import_status present)
  - Gemfile additions: nokogiri, pdf-reader, sage-rb, aws-sdk-s3, image_processing
  - GoodJob installed and initialized (inline test, async dev, external prod)
  - RecipeIngestion::UrlParser — Net::HTTP fetcher with SSRF guards (private/loopback/link-local), redirect cap (5), 5MB size cap, 15s open + 20s read timeouts, retry-once-on-timeout, browser-like User-Agent (avoids Cloudflare 403s)
  - RecipeIngestion::JsonLdExtractor — finds Schema.org Recipe in any JSON-LD block (top-level, @graph wrappers, root arrays, @type arrays, multi-script pages); skips invalid JSON gracefully
  - RecipeIngestion::MicrodataExtractor — generic Schema.org HTML5 microdata parser; recurses into nested HowToStep itemscopes; extracts time via datetime attribute, img via src, meta via content; matches both http/https itemtype URLs
  - RecipeIngestion::OpenGraphExtractor — last-resort fallback for sites with no structured data; pulls og:title/og:description/og:image with twitter:* and <title>/<meta name=description> fallbacks
  - RecipeIngestion::Normalizer — Schema.org → Recipe attrs; ISO 8601 durations including the verbose P0DT0H20M0S form; freeform recipeYield parsing ("Makes 12 cookies" → 12); category mapping with safe drops for unknown values; HowToSection flattening for nested instruction arrays; totalTime support for sites that don't break out prep/cook
  - RecipeIngestion::UrlIngester orchestrator — tries JSON-LD → microdata → Open Graph in priority order; sufficient? requires both ingredients AND instructions for "complete" (otherwise needs_review)
  - RecipeIngestionJob (GoodJob) — async dispatch by import_source_type, discard_on StandardError marks recipe failed with error message, mark_failed always sets a fallback title so failed recipes are renderable
  - Api::V1::ImportsController — POST /imports creates draft + enqueues job (returns 202), GET /imports/:apikey for polling status; member role rejected via existing RecipePolicy#create?
  - RecipesController#index excludes importing drafts via IS DISTINCT FROM (handles NULL correctly — initial where.not bug caught by existing test suite)
  - RecipesController#show exposes import_status, import_source_type, import_error
  - Frontend types: ImportStatus, ImportSourceType, ImportSummary, Recipe extended with import fields
  - Frontend api/imports.ts: createUrlImport, getImport
  - Frontend ImportModal — bottom-sheet on mobile, focus management, Esc-to-close, error surface, navigates to /recipes/:apikey on success
  - Frontend ImportProgress — TanStack Query refetchInterval polling (1.5s), invalidates parent recipe query on completion so RecipeDetail re-renders into normal view automatically; dedicated failed state with original-source link
  - Frontend RecipeDetail — short-circuits to ImportProgress when import_status is importing/failed; amber needs_review banner with "Edit recipe" CTA for partially-imported recipes
  - Frontend RecipeCard — defensive null-title handling (cheap insurance against future bugs)
  - Frontend Recipes page — Import button next to Add (admin/owner only)
  - 54 new backend tests across JsonLdExtractor (7), Normalizer (16), MicrodataExtractor (9), OpenGraphExtractor (6), RecipeIngestionJob (6), ImportsController (10) — 91/91 passing
  - End-to-end tested against real URLs: NYT/Serious Eats/Bon Appétit (JSON-LD → complete), Smitten Kitchen (microdata → needs_review with 12 ingredients + title + servings + total time), Tastefully Simple (Open Graph → needs_review with title/description/image)

## Next Session
Phase 4 sub-phase B: encrypted LLM API key storage + sage-rb wrapper using per-request Sage::Configuration (no global state to avoid races between users), ActiveStorage with Cloudflare R2 for source attachments, PDF/image ingestion paths, Settings ApiKeyForm UI. Then we can revisit the same Tastefully Simple URL and have it parse cleanly via LLM extraction.
