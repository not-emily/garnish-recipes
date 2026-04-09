# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-5.md](../docs/plan/phases/phase-5.md)
Latest Weekly Report: None
Latest Daily Report: [daily-2026-04-09.md](../docs/reports/daily-2026-04-09.md)

Last Updated: 2026-04-09

## Current Focus
Phase 5: Meal Planning — sub-phases A and B are shipped and verified. Sub-phase C (mobile swipe view + drag-and-drop) is **code-complete but UNTESTED end-to-end** — needs smoke testing before sub-phase D. Sub-phase D (ActionCable real-time sync) still pending.

## Active Tasks
- [IN PROGRESS] Phase 5: Meal Planning
  - ✓ Sub-phase A: Core CRUD grid (desktop/tablet)
    - ✓ MealPlan + MealPlanEntry models, migration, lazy per-week creation, Monday canonicalization
    - ✓ MealPlansController + MealPlanPolicy (all household members can CRUD — collaborative workspace, not admin-gated)
    - ✓ Routes: show/create/update/destroy/reorder
    - ✓ 17 new backend tests (auto-create, canonicalization, CRUD, scoping, position, reorder, cross-household protection)
    - ✓ Frontend types, api client, useMealPlan hook with TanStack Query cache patching
    - ✓ Weekly grid UI: WeekView, DayColumn, MealSlot, MealEntry with today-accent and responsive grid
    - ✓ Week navigation (prev/today/next) with formatted week range header
    - ✓ Pure date helpers (lib/weekUtils) — dependency-free, local-timezone parsing
  - ✓ Sub-phase B: Entry variety + per-entry settings + UX polish
    - ✓ EntryPicker with Recipe/Event/Note tabs (3 tabs, not 4 — quick meals live inside Recipe tab with pill filter)
    - ✓ Recipe tab: search + pill filter (All/Recipes/Quick meals), events filtered out of default browse
    - ✓ Quick meal inline creation with category/servings/primary protein (quick meals live in the library for reuse)
    - ✓ Event tab: browse past 5 events (capped via backend limit param), "Create <search>" with title pre-fill
    - ✓ Note tab: freeform title, recipe_id null
    - ✓ EntryOptions modal with simplified variant for events/notes (no servings/grocery for non-cooked entries)
    - ✓ Backend coerces include_in_grocery: false for events/notes via before_validation (Phase 7 grocery gen can just filter by the flag)
    - ✓ Derived grocery_relevant? helper on MealPlanEntry, exposed in serializer
    - ✓ Main RecipeBrowser hides events entirely — events are meal-plan-only
    - ✓ Recipes index `limit` param with 200-row ceiling
    - ✓ Context-aware back button — Meal Plan ← from recipe detail when arrived via meal plan link, Recipes ← otherwise, via React Router location.state
    - ✓ Meatball menu visibility: hidden-at-rest-on-desktop / always-on-touch using runtime matchMedia (hook useMediaQuery) — Tailwind v4 arbitrary variant parser didn't reliably accept the combined `(min-width: 1024px) and (hover: hover)` media query, so JS is more reliable
    - ✓ Rules-of-Hooks fix in EntryPicker (useQuery was after a conditional early-return → white screen on create)
    - ✓ placeholderData: keepPreviousData on search queries to prevent flicker on every keystroke
    - ✓ 3 new tests for grocery coercion (events forced false, notes forced false, recipes kept true) — 130/130 passing
  - ⏳ Sub-phase C: Mobile experience + drag-and-drop — **code-complete, needs smoke testing**
    - ✓ @dnd-kit/core + @dnd-kit/sortable installed
    - ✓ WeekView wrapped in DndContext — PointerSensor (5px distance) + TouchSensor (250ms delay)
    - ✓ SortableMealEntry wrapper with post-drag click suppression (prevents Link navigation after drag)
    - ✓ MealSlot as useDroppable + SortableContext; highlight ring on drag-over
    - ✓ Same-slot reorder → reorderEntries mutation (optimistic cache with rollback)
    - ✓ Cross-slot drag → updateEntry(date, meal_slot) — backend appends at end
    - ✓ DragOverlay shows ghost of active entry
    - ✓ MobileDayView — single-day swipe (Framer Motion drag="x" with velocity detection), replaces 1-col fallback below sm breakpoint via useMediaQuery
    - ✓ Day strip header (7 buttons, tap to jump, today accent, active inverted)
    - ✓ Resets to today's column on mount + on week change
    - ✓ useLongPress hook (500ms hold, 8px move threshold, click suppression)
    - ✓ Tap-to-move flow: long-press entry → highlight ring + "Moving X — tap a slot" banner → swipe to target day → tap "Move here" → updateEntry; tapping source slot or banner X cancels
    - ✓ MobileMealEntry wrapper threads long-press + move-target highlight into non-sortable mobile layout
    - ✓ 130/130 backend tests pass, vite build clean, zero new TS errors
    - ⏳ **Needs end-to-end smoke testing**: desktop drag reorder, desktop cross-slot drag, mobile swipe nav, mobile long-press → move flow, recipe detail link still works after cancelled drag
  - ⏭ Sub-phase D: Real-time sync via ActionCable
    - ⏭ Enable action_cable/engine in application.rb
    - ⏭ MealPlanChannel with per-household subscription, broadcasts on CRUD
    - ⏭ Frontend subscription in useMealPlan — merge remote updates into the TanStack cache
    - ⏭ Tests for channel authorization and broadcast payloads
- [NEXT] Follow-up: Image ingestion via vision (deferred from Phase 4)
  - ⏭ Upstream multi-modal content support to sage-rb (Option C from the sub-phase B decision)
  - ⏭ ImageIngester that renders PDF pages → images for scanned cookbooks, and handles direct image uploads
  - ⏭ Re-process action on needs_review recipes so image PDFs uploaded today auto-process when vision lands
- [NEXT] Follow-up: recipe detail source attachment download UI
  - ⏭ Show attached source PDF on detail page with download link
  - ⏭ Signed URL via ActiveStorage routes

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
- [2026-04-08] Phase 4 sub-phase B: LLM + PDF + attachments + key management
  - Active Record encryption keys wired through Figaro (AR_ENCRYPTION_PRIMARY_KEY, _DETERMINISTIC_KEY, _KEY_DERIVATION_SALT) via a new initializer; Garnish avoids the standard credentials.yml.enc flow since it already uses Figaro for everything else
  - Migration: llm_provider, llm_model, llm_api_key (text, encrypted) on users
  - User model: encrypts :llm_api_key, LLM_PROVIDERS enum, has_llm_credentials?, validates all-three-set-or-all-three-blank
  - ActiveStorage enabled (engine un-commented in application.rb), install migration run
  - config/storage.yml: local disk for dev/test, cloudflare_r2 S3-compatible service for prod with endpoint derived from CLOUDFLARE_R2_ACCOUNT_ID; production falls back to local if R2 creds aren't set
  - Recipe has_one_attached :source_file for PDFs/images
  - RecipeIngestion::LlmExtractor — sage-rb wrapper that builds a fresh Sage::Configuration per call (no global state, no races between users); strips markdown fences, truncates content to 100KB, structured JSON output, tight error handling via custom ExtractionError
  - RecipeIngestion::PdfParser — pdf-reader wrapper with 200KB text cap, safe MalformedPDFError rescue
  - RecipeIngestion::PdfIngester — reads attached source_file, extracts text, hands to LlmExtractor; degrades gracefully when text is empty, user has no credentials, or LLM call fails
  - RecipeIngestion::UrlIngester upgraded — four-tier cascade is now JSON-LD → microdata → LLM (if user has key and structured extraction was partial) → Open Graph; merge_best combines partial structured results with LLM completions so the cheapest path wins first
  - RecipeIngestionJob — dispatches via `ingest` generic flow, carries result[:error] through to import_error on needs_review too (not just failed), so users see why a partial import landed where it did
  - ImportsController accepts multipart file uploads via params[:file]; detects source_type via content_type (application/pdf → pdf, image/* → image)
  - ImportsController fast-fail routing for image-based PDFs: peeks at page 1 synchronously via PDF::Reader, skips the job entirely and lands directly in needs_review with a "vision coming soon — file saved, will auto-process later" message; preserves the file so vision support can re-process it when it lands
  - Api::V1::UserSettingsController: GET/PATCH /api/v1/user/settings (has_llm_key boolean only, never echoes the saved key); POST /api/v1/user/settings/test_llm (fires a tiny "reply ok" prompt against saved or ad-hoc credentials, reports auth_failed/connection_failed/provider_error codes for actionable UI feedback)
  - Frontend api/userSettings.ts typed client + LlmTestResult discriminated union
  - Frontend api/client.ts detects FormData and skips the default JSON Content-Type so multipart uploads work
  - Frontend api/imports.ts: createFileImport via FormData
  - Frontend ImportModal — URL/PDF tabs with per-tab mutations; PDF tab has a plain-language "selectable text required" warning explaining the limitation in terms users understand
  - Frontend ApiKeyForm — provider dropdown (Anthropic/OpenAI/Ollama) with per-provider model recommendations in helper text, password-style API key input (never hydrates saved value), test-connection button (shows the model's actual reply or a targeted error), save button disables until the form is dirty, Remove button with confirmation
  - Bug fix (caught during smoke testing): form was sending llm_api_key: null when user didn't type a new key, which cleared their saved credentials on a second save; now omits the field entirely unless the user typed something, and the save button disables until dirty
  - Bug fix: import_error now flows to needs_review recipes too (previously only failed), so the banner can explain *why* an import is partial (missing text layer, no LLM credentials, partial structured data, etc.)
  - Frontend RecipeDetail needs_review banner reads import_error and displays it verbatim when present; falls back to generic "couldn't extract all details" otherwise
  - 19 new backend tests across LlmExtractor (8, with sage-rb stubbed) and UserSettingsController (11, covering show/update/test_llm in success and error paths) — 110/110 total passing
  - Image ingestion intentionally deferred: sage-rb's provider adapters only accept string prompts, not vision content blocks. Fix is to add multi-modal content support to sage-rb upstream (Option C from the decision discussion) before enabling the image path here.
  - Verified end-to-end against real URLs: Smitten Kitchen microdata partial now completes via LLM, Tastefully Simple no-structured-data completes via LLM, NYT/Serious Eats still complete via free JSON-LD path (no unnecessary LLM spend)

## Next Session
1. **Smoke test Phase 5 sub-phase C** — run `foreman start -f Procfile.dev`, test desktop drag (reorder + cross-slot), mobile swipe nav, mobile long-press → tap-to-move, verify recipe detail link works after cancelled drag. Fix any issues found.
2. Phase 5 sub-phase D (ActionCable real-time sync). After that, Phase 6 (leftover automation — the columns and household settings are already in place from Phase 5's migration, just need the UI and logic).
