# Weekly Report - Garnish - Week of 2026-04-06 (ISO Week 15)

## Week Overview
Launch week. Garnish went from empty repo to a working multi-tenant household meal planning app with recipe CRUD, URL/PDF recipe ingestion, weekly meal planning with drag-and-drop, mobile swipe navigation, and ActionCable real-time sync. Five of ten planned phases are complete or code-complete, covering the entire critical MVP path except grocery lists.

## Key Accomplishments

### Foundation & Infrastructure (Phase 1)
- Rails 8 API-only monorepo with React 19 + Vite + TypeScript PWA
- JWT auth (access token + httpOnly refresh cookie) with automatic refresh on 401
- Tailwind CSS 4, TanStack Query, React Router 7, Framer Motion
- Docker Compose Postgres (port 5433)
- GitHub Actions: test workflow + backend deploy via Tailscale SSH to MacBook server
- Procfile.dev for foreman-based local dev

### Auth Hardening
- Project-auditor review (verdict: B-, sound architecture)
- Refactored refresh tokens to single `<apikey>.<random>` cookie with JWT type validation
- Exposed public `apikey` as `id` to keep internal integer IDs private
- Fixed Safari logout bug (SameSite=None; Secure mismatch on clear)
- Fixed HouseholdContext race condition
- 17 minitest auth specs

### Households & Multi-Tenancy (Phase 2)
- Household + HouseholdMembership models, food-themed invite codes (SAUTE-SAGE-84)
- Roles (owner/admin/member) and grocery permissions (read/contribute/full)
- HouseholdScoped concern for automatic query scoping
- Pundit-style policies with structured reason codes
- Onboarding flow (create or join), member management UI, invite flow with copy + regenerate

### Recipes (Phase 3)
- Recipe model with JSONB ingredient_groups and instructions, apikey-as-id
- RecipePolicy with nested Scope class, full CRUD + search + filter + sort
- Smart filter chips — only show types/categories that actually exist in the household
- Recipe browser, detail page with numbered instructions + timer support, create/edit forms
- IngredientEditor with sections and reordering, InstructionEditor with timers
- Single-recipe JSON export
- Context-aware back button (routes through React Router location.state)

### Recipe Ingestion (Phase 4)
- **Sub-phase A: URL imports** — SSRF-guarded fetcher, JSON-LD / microdata / Open Graph / LLM four-tier cascade. Handles ISO 8601 durations, Schema.org recipeYield, HowToSection flattening. GoodJob async processing with polling UI. Tested against NYT, Serious Eats, Bon Appétit, Smitten Kitchen, Tastefully Simple.
- **Sub-phase B: LLM + PDF + attachments** — Active Record encryption for LLM API keys (Figaro-wired, not credentials.yml.enc), sage-rb wrapper with per-call fresh config, pdf-reader integration with vision-deferred fast-fail for image PDFs, ActiveStorage with Cloudflare R2 for prod. User settings controller with test-connection flow. 54 + 19 ingestion tests.

### Meal Planning (Phase 5)
- **Sub-phase A: Core CRUD grid** — MealPlan + MealPlanEntry models, lazy per-week creation, Monday canonicalization, collaborative policy (all members can CRUD), 17 backend tests. Frontend: WeekView, DayColumn, MealSlot, MealEntry with responsive grid and today accent.
- **Sub-phase B: Entry variety** — EntryPicker with Recipe/Event/Note tabs, inline quick meal creation, Event tab with past-5 browse, note entries. EntryOptions modal with simplified variant for events/notes. Backend grocery coercion for non-cooked entries.
- **Sub-phase C: Drag-drop + mobile** — @dnd-kit desktop drag-drop with same-slot reorder and cross-slot move, DragOverlay, click suppression for recipe links. Mobile single-day swipe view with Framer Motion, long-press initially then replaced with real drag-and-drop (TouchSensor). Edge-scrolling during drag with self-rescheduling timer. Full slot highlight, smooth week transitions via keepPreviousData.
- **Sub-phase D: ActionCable real-time sync (code-complete, untested)** — Async adapter, JWT query param auth, MealPlanChannel with household-scoped stream_for, broadcasts on all CRUD actions with actor_apikey filtering. Frontend singleton consumer, useMealPlan subscription with applyBroadcast helper. 9 new channel tests.

### Polish & Bug Fixes (late week)
- Drag-drop snap-back animation eliminated (transition:null, dropAnimation:null, sync optimistic updates, opacity:0 during drag)
- HTML entity decoding in recipe normalizer (CGI.unescapeHTML for JSON-LD imports)
- Bottom sheet z-index fix (z-50 → z-[60] above bottom nav)
- Framer Motion swipe direction fix (variants with custom prop)
- Render-time week change detection (replaces useEffect, avoids StrictMode double-fire)

## Decisions This Week
Five architectural decisions logged on 2026-04-06, plus several implementation-level choices later in the week:

1. **Rails API + React PWA monorepo** — Rich interactivity (drag-drop, swipe, real-time) favors React over Hotwire → everything in one repo, frontend to CF Pages, backend to MacBook.
2. **Self-hosted on MacBook Pro via Cloudflare Tunnel (no Docker)** — Zero monthly cost, full WebSocket support, no Mac VM overhead → dev on Arch differs from prod on macOS, CI catches issues.
3. **Recipes belong to households, export on leave** — Avoids "personal vs household library" decision fatigue → collection references are user-owned, recipes are household-owned.
4. **LLM features as optional BYOK** — No ongoing dev costs, accessible to non-technical users → ingestion has free JSON-LD path and paid LLM fallback.
5. **Meal plan entries as polymorphic types (recipe/quick_meal/event/note)** — Real meal planning isn't just recipes → unified browse via recipe_type enum.

Sub-phase D implementation decisions:
- **Broadcast from controller, not model callbacks** — Simpler scope, keeps serialization in one place.
- **actor_apikey (not actor_id) in broadcasts** — Matches frontend convention, avoids exposing internal IDs.
- **JWT in query param for WebSocket auth** — ActionCable doesn't support custom handshake headers.
- **Singleton ActionCable consumer** — Built-in auto-reconnect, one connection per user.

## Challenges Encountered

- **Auth layer audit (Phase 1)** — Found and fixed a separator collision (`_` in apikey conflicted with `_` as token separator → switched to `.`), Safari logout bug (SameSite=None; Secure mismatch), HouseholdContext race condition, refreshPromise deduplication bug.
- **Cloudflare 403s on URL imports** — Fixed with browser-like User-Agent header.
- **Smitten Kitchen microdata partial imports** — Solved with LLM fallback in Phase 4B's four-tier cascade.
- **Image PDFs (scanned cookbooks)** — Detected via PDF::Reader page-1 peek and landed in needs_review with "vision coming soon" message. Upstream sage-rb fix required before shipping.
- **Drag-drop snap-back flash** — Root-caused to React/dnd-kit timing: async onMutate ran in a microtask after dnd-kit cleared transforms, leaving a visible frame at old position. Fixed with synchronous onMutate (removed await) + transition:null + opacity:0 during drag.
- **Mobile cross-week swipe bug (unresolved)** — Tried multiple fixes (StrictMode render-time adjustment, stuck-drag cleanup, onDragCancel) but swiping past Sunday/Monday still doesn't advance the week. Deferred to next session for deeper investigation into Framer Motion + DndContext interaction.

## Metrics
- **Commits:** 10 (including initial commit)
- **Files touched:** 269 (across the week's commits)
- **Insertions:** ~20,800 lines
- **Deletions:** ~1,900 lines
- **Backend tests:** 0 → 139 passing (293 assertions)
- **Phases shipped:** 4 complete (1, 2, 3, 4) + Phase 5 partially complete (5A/5B/5C shipped, 5D code-complete)
- **Uncommitted work at week's end:** Phase 5D (ActionCable sync)

## Next Week Priorities

1. **Smoke test Phase 5 sub-phase D end-to-end** — Two-tab test with different household members, verify all four broadcast types propagate without double-apply. Commit once verified.
2. **Debug the mobile cross-week swipe bug** — Deferred from sub-phase C smoke testing. Needs deeper investigation into Framer Motion / DndContext interaction at week boundaries.
3. **Phase 6: Leftover automation** — DB columns and household settings are already in place from Phase 5's migration. Needs UI and logic for generating leftover entries from recipes with extra servings.
4. **Phase 7: Grocery lists** — The critical-path MVP feature that remains. Entries are already flagged with `include_in_grocery` from Phase 5B.
