# Stabilization, Polish & Sharing

> **Status:** Planning complete | Last updated: 2026-04-22
>
> Phase files: [phases/](phases/)

## Overview

A post-MVP initiative driven by ~1 week of real-world Garnish usage. The MVP (v1) and nav/search rework (v2) have shipped; daily use has surfaced a cluster of intermittent bugs — random logouts, ghosted grocery items, duplicate-submit entries, "no-op" feeling UI during server slowness — plus a handful of UX sharp edges and feature gaps.

The common thread across most reported bugs is **poor error and pending-state legibility**. When the Rails backend on the MacBook has a transient issue (worker starvation, pool exhaustion, Cloudflare Tunnel blip), the frontend silently treats it as a generic error, sometimes clearing auth, sometimes doing nothing, and users are left guessing whether their action worked. Fixing the resilience framework at the frontend layer eliminates multiple symptom-bugs as a side effect.

This plan is structured in four phases, ordered by impact: frontend resilience (surfaces and tolerates failures honestly), then backend stability (reduces failures at the source), then UX polish (nav sizing, gesture fixes, filter persistence), then the three net-new features users have asked for (link-based recipe sharing, personal favorites filter, cook-count stats).

## Core Vision

- **Make failures legible**: Every pending mutation has a visible state. Every failure tells the user what happened and how to retry. No silent no-ops, no mystery "oops" pages.
- **Tolerate the server's off days**: Transient errors — 5xx, timeouts, network drops — never clear auth or kick the user out. They surface as banners and retry affordances instead.
- **Capture data now, reveal later**: Cook tracking, recipe stats, and similar signal-gathering features should denormalize the data cheaply and surface small amounts of it. Richer filters/views can come later once we know what's useful.
- **Opt-in sharing, not ambient**: Sharing is an explicit action the user takes per-recipe, matching how Notion/Google Docs "share to web" works — no always-on public URLs, no inbox/notification complexity.

## Requirements

### Must Have

**Phase 1 (Resilience):**
- API client error taxonomy distinguishing auth / transient / client / offline errors
- 401 is the **only** status that clears auth — 5xx, timeouts, and network errors keep the session alive
- `OfflineBanner` upgraded to cover server-unreachable states (5xx, timeouts), not just `navigator.onLine`
- Every mutation button: idle / pending / error states enforced; disabled while in-flight
- Optimistic updates visibly distinct from confirmed state (pending visual + rollback on failure)
- Queries auto-retry with backoff; mutations do not (surface retry affordance instead)
- ActionCable disconnect surfaces a "reconnecting…" indicator
- Generic "oops we encountered an error" page replaced by banner + inline retry for transient errors
- Grocery ghost-item bug fixed (audit optimistic state + cable broadcast handlers + query invalidation)
- Add-grocery-item form closes/clears on success
- Recently-made sort actually sorts by last_cooked_at (currently falling through to updated_at)

**Phase 2 (Backend):**
- Puma worker/thread count tuned for observed load
- Database connection pool sized appropriately (web + GoodJob + Cable)
- GoodJob state audit (no stuck/looping jobs, memory within budget)
- Cloudflare Tunnel stability assessed
- Structured health logging so the next outage is diagnosable without being on a laptop

**Phase 3 (UX Polish):**
- Mobile input zoom investigation (intermittent; verify current fix)
- Bottom nav sizing increased, bottom padding added, dead-zone between nav and search cleared
- Grocery slide-to-delete gesture: straight left, no upward drift
- Recipe browse filter state + scroll position persist on back-navigation from recipe detail
- Store sorting reliability verified (likely resolved by Phase 1 pending-state work)

**Phase 4 (Features):**
- Recipe share-to-link: opt-in `share_token`, public `/r/shared/:token` route, copy-on-save, revocable
- "My favorites" filter chip (my_rating ≥ 4)
- "Not rated by me" filter chip (my_rating is null)
- "My rating" sort option
- Cook tracking trigger verified and corrected (counts date-passed-not-deleted, not schedule time)
- "Last made · Made N times" shown on recipe detail page

### Nice to Have

- A `/health` endpoint + lightweight uptime tracker for external monitoring
- Separating ActionCable into its own process if worker starvation is confirmed as root cause
- Subtle "you've rated this" pip on recipe cards (hold for v2 of favorites)
- "Haven't made in 30+ days" and "Never made" rediscovery filters (data captured in Phase 4, UI deferred)

### Out of Scope

- Recipe images (add/edit) — separate initiative
- Cooking mode UI (toggle between recipes in a slot while cooking) — separate initiative
- Quick filter pills on recipe browse — separate initiative
- Fraction support for ingredient quantities — separate initiative
- "What's on the menu" banner — separate initiative
- Instruction sections / groups — separate initiative
- Password strength validation, Google OAuth, Settings page redesign — separate initiatives
- Full visual re-theme — separate initiative
- Tutorial/coachmark system — separate initiative
- Image ingestion via vision (Phase 4 leftover) — separate initiative
- PDF export for recipes/collections — separate initiative

## Constraints

- **Tech stack**: Existing (Rails 8 API + React 19 PWA, PostgreSQL 16, GoodJob async, ActionCable async adapter). No new dependencies unless justified in-phase.
- **Team**: Solo developer, off-hours cadence
- **Deployment**: Backend runs natively on a MacBook Pro via Cloudflare Tunnel; frontend on Cloudflare Pages. No Docker. Limits some diagnostic conveniences (no container logs, no remote shell without Tailscale).
- **Platform**: Mobile-first PWA, iOS Safari primary target
- **Users**: Personal/friends-and-family — can tolerate rolling fixes and minor downtime; diagnostic logging is acceptable
- **Sequencing**: Phase 1 ships before Phase 2 (frontend masks flakiness before we dig into the server); Phases 3 and 4 can be done in either order or interleaved

## Success Metrics

- Zero "random logouts" reported after Phase 1 ships (5xx no longer clears auth)
- Grocery ghost items no longer reproducible after Phase 1
- Duplicate grocery entries from rapid tapping no longer possible (button pending state)
- Server outage events produce actionable logs (timestamp, duration, cause hypothesis) after Phase 2
- "Recently cooked" sort orders by last_cooked_at in production
- Share link flow: recipe owner can share → link opens → non-member can view → logged-in user can copy to household
- "My favorites" filter returns recipes the current user has rated ≥ 4
- Recipe detail page shows "Last made · Made N times" where data exists

## Architecture Decisions

### 1. Error Taxonomy in the API Client
**Choice:** Classify every API error into one of four buckets at the interceptor layer: `auth` (401), `client` (4xx except 401), `transient` (5xx + timeouts + network errors), `offline` (`navigator.onLine === false` or sustained transient failures).
**Rationale:** The current code path treats "any error" the same way, which is why a backend 502 during a worker starvation blip looks identical to a real auth failure. A taxonomy lets the UI respond appropriately: keep session, retry, show banner, or clear auth — whichever is actually right.
**Trade-offs:** Every call site that handles errors needs to be updated to read the category. Worth the churn once — the alternative is scattered ad-hoc checks.

### 2. Only 401 Clears Auth
**Choice:** The auth interceptor clears tokens and redirects to sign-in **only** on HTTP 401. All other errors keep the session untouched.
**Rationale:** User-reported "random logouts" correlate with the generic "oops" error page — strongly suggesting transient server errors were being handled by the auth-clear path. Real auth failures are explicit and rare; transient errors are common and should not look the same.
**Trade-offs:** A genuinely bad token (somehow stored but rejected) keeps trying until the server confirms 401. Acceptable — this is the correct behavior.

### 3. Mutations Don't Auto-Retry
**Choice:** GET queries auto-retry with exponential backoff (2–3 attempts). Mutations (POST/PATCH/DELETE) never auto-retry — they surface an error toast with a manual retry action.
**Rationale:** Auto-retrying mutations risks double-writes (grocery item added twice, rating submitted twice). The duplicate-entry bug users hit by rapid-tapping the Add button would be even worse with silent auto-retry. Manual retry preserves user intent.
**Trade-offs:** Users see error states more often than if we silently recovered. That's the point — legibility over hidden magic.

### 4. Opt-In Share Tokens, Not Always-On
**Choice:** Recipe share links require an explicit "Share" action that generates a nullable `share_token` on the recipe. Revoke nulls the token (next share regenerates).
**Rationale:** Even unguessable UUIDs make users uncomfortable if every recipe has a "secretly public" URL. Explicit action matches the mental model users already have from Notion/Google Docs. Revocable without database migration gymnastics.
**Trade-offs:** One extra tap to share vs. "just copy the URL from the address bar." Acceptable — shared URLs are short-lived and explicit.

### 5. Cook Count via Nightly Tally, Not After-Commit
**Choice:** Move cook-tracking from `MealPlanEntry` `after_commit` on create to a nightly job that counts yesterday's entries that still exist, incrementing `cook_count` and updating `last_cooked_at`.
**Rationale:** The after_commit on create counts a meal as "cooked" at schedule time, which is wrong — if you plan Thursday's dinner on Sunday, you've not cooked it yet. A scheduled entry that gets deleted before its date should not count. A nightly tally over date-passed entries gives clean semantics without a "mark as made" UI.
**Trade-offs:** Data lags up to 24h. Acceptable for personal meal planning. If we ever need realtime, compute lazy.

### 6. Shared Optimistic-Update Helper
**Choice:** A single helper (hook or utility) that wraps TanStack Query mutations with a consistent pending-visual pattern (opacity fade or pending dot), rollback on failure, and error-toast with retry.
**Rationale:** The grocery ghost bug is likely a bespoke optimistic-update path that leaves partial state behind on failure. Rather than audit every mutation's one-off optimistic logic, centralize the pattern so ghost-state bugs become architecturally impossible.
**Trade-offs:** Existing mutations need to migrate to the helper. Incremental migration is fine — new code uses the helper immediately, old mutations move over as touched.

## Project Structure

No new top-level directories. Changes are scoped to existing locations:

```
backend/
├── app/
│   ├── controllers/api/v1/
│   │   └── shared_recipes_controller.rb   # NEW: public share-link routes
│   ├── models/
│   │   └── recipe.rb                       # Add share_token, generate/revoke methods
│   ├── jobs/
│   │   └── tally_cooks_job.rb              # NEW: nightly cook-count tally
│   └── policies/
│       └── shared_recipe_policy.rb         # NEW: public-read policy for /shared/:token
├── config/
│   ├── puma.rb                             # Tune workers/threads
│   ├── database.yml                        # Pool size review
│   └── recurring.yml or good_job.rb        # Schedule TallyCooksJob
└── db/migrate/                             # share_token, cook_count, last_cooked_at if missing

frontend/
├── src/
│   ├── lib/
│   │   ├── api.ts                          # Error taxonomy + interceptor rewrite
│   │   ├── useOptimisticMutation.ts        # NEW: shared optimistic-update helper
│   │   └── connectionState.ts              # NEW: reconnection heartbeat + status source
│   ├── components/
│   │   ├── layout/
│   │   │   ├── OfflineBanner.tsx           # Expand to cover server-unreachable states
│   │   │   ├── BottomNav.tsx               # Sizing + bottom padding + dead-zone fix
│   │   │   └── ConnectionIndicator.tsx     # NEW: "reconnecting…" cable status
│   │   ├── grocery/
│   │   │   ├── GroceryItemList.tsx         # Slide-to-delete gesture fix
│   │   │   └── AddGroceryItemForm.tsx      # Close/clear on success, pending state
│   │   └── recipes/
│   │       ├── RecipeBrowser.tsx           # Filter + scroll persistence on back-nav
│   │       ├── RecipeDetail.tsx            # "Last made · Made N times" line; Share menu
│   │       ├── RecipeFilterPanel.tsx       # "My favorites" + "Not rated by me" chips, "My rating" sort
│   │       └── ShareRecipeDialog.tsx       # NEW: share-link dialog
│   ├── pages/
│   │   └── SharedRecipe.tsx                # NEW: public /r/shared/:token view
│   └── hooks/
│       ├── useGroceryList.ts               # Audit optimistic state + ghost bug fix
│       └── useRecipeFilters.ts             # Persist state across navigation
```

### Key Files
- `frontend/src/lib/api.ts` — error taxonomy; the interceptor that ends the "random logout" bug
- `frontend/src/lib/useOptimisticMutation.ts` — shared helper; once mutations migrate, ghost-state bugs become architecturally impossible
- `frontend/src/components/layout/OfflineBanner.tsx` — the visible honesty channel; expanded to cover server-side unavailability
- `backend/config/puma.rb` — likely root cause of intermittent unavailability; tuning happens in Phase 2
- `backend/app/jobs/tally_cooks_job.rb` — correct semantics for cook count; replaces the after_commit trigger
- `frontend/src/pages/SharedRecipe.tsx` — public route; no auth required

## Core Interfaces

### API Error Taxonomy

```typescript
type ApiErrorCategory =
  | "auth"       // 401 — clear session, redirect to sign-in
  | "client"     // 4xx (not 401) — surfaced as validation/user error
  | "transient"  // 5xx, timeout, network — keep session, banner + retry
  | "offline";   // navigator.onLine false, or sustained transient

interface ApiError {
  category: ApiErrorCategory;
  status: number | null;     // null for network/offline
  message: string;
  retryable: boolean;
  originalError: unknown;
}
```

### Optimistic Mutation Helper

```typescript
interface UseOptimisticMutationOptions<TVariables, TData> {
  mutationFn: (vars: TVariables) => Promise<TData>;
  onOptimisticUpdate: (vars: TVariables) => void;  // cache update
  onRollback: (vars: TVariables) => void;          // undo cache update on failure
  invalidateKeys?: QueryKey[];
  pendingVisual?: "fade" | "dot" | "none";
  successToast?: string;
  errorToast?: (err: ApiError) => string;
}
```

### Recipe Share API

```
POST   /api/v1/recipes/:id/share     -> { share_token: "uuid" }  # generates if null, returns existing otherwise
DELETE /api/v1/recipes/:id/share     -> 204                       # revokes (nulls token)

GET    /r/shared/:token              -> public view (no auth)
POST   /api/v1/shared_recipes/:token/copy  -> copies recipe to current user's active household
```

### Cook Stats (denormalized on Recipe)

```ruby
# Recipe model additions (or confirmations if already present)
# last_cooked_at :datetime
# cook_count     :integer, default: 0

# TallyCooksJob runs nightly:
# - Finds MealPlanEntry records where date = yesterday
# - Groups by recipe_id
# - Increments cook_count and updates last_cooked_at
```

## Implementation Phases

| Phase | Name | Scope | Depends On | Key Outputs |
|-------|------|-------|------------|-------------|
| 1 | Connection Resilience & Honest UI | Error taxonomy, OfflineBanner expansion, pending/error states everywhere, shared optimistic-mutation helper, grocery ghost fix, sort fix | — | Rewritten `api.ts`, `useOptimisticMutation`, updated `OfflineBanner`, `ConnectionIndicator`, grocery + recipe mutation audits |
| 2 | Backend Stability | Puma tuning, DB pool sizing, GoodJob audit, CF Tunnel assessment, structured health logging | — (but runs after Phase 1 so users are already protected) | Tuned `puma.rb`, pool config, health logging, diagnostic runbook |
| 3 | UX Polish | Mobile zoom verify, nav sizing + padding + dead-zone, grocery slide gesture, filter/scroll persistence | Phase 1 (for mutation state patterns) | Updated `BottomNav`, `GroceryItemList`, `RecipeBrowser`, `useRecipeFilters` |
| 4 | Features: Sharing, Favorites, Cook Stats | Share-link backend + UI, favorites/not-rated filters + "My rating" sort, cook-count trigger fix + recipe-detail stats line | Phase 1 (mutation patterns); Phase 3 optional | New `shared_recipes_controller`, `SharedRecipe` page, `ShareRecipeDialog`, filter panel updates, `TallyCooksJob`, recipe detail updates |

### Critical Path
Phase 1 is the foundation — it must ship first. Its patterns (error taxonomy, optimistic helper, pending states) are used by Phases 3 and 4. Phase 2 is investigation-heavy infrastructure work that can run after Phase 1 or in parallel with Phase 3. Phases 3 and 4 are independent of each other and can be done in either order, or phase-by-phase interleaved (e.g., Phase 3 UX polish before the feature work in Phase 4).

### Phase Details
- [Phase 1: Connection Resilience & Honest UI](phases/phase-1.md)
- [Phase 2: Backend Stability](phases/phase-2.md)
- [Phase 3: UX Polish](phases/phase-3.md)
- [Phase 4: Features — Sharing, Favorites, Cook Stats](phases/phase-4.md)

## Tech Stack

| Category | Choice | Notes |
|----------|--------|-------|
| Backend | Rails 8, Ruby 3.x | Existing; no version changes |
| Database | PostgreSQL 16 | Existing |
| Background jobs | GoodJob (async) | Existing; will host `TallyCooksJob` |
| Realtime | ActionCable (async adapter) | Existing; Phase 2 may evaluate process separation |
| Web server | Puma | Tuning target in Phase 2 |
| Frontend | React 19, TypeScript, Vite, TanStack Query | Existing |
| Error state | `OfflineBanner` + new `ConnectionIndicator` | Expanding existing components |

## Future Considerations

- **Rediscovery filters** ("Haven't made in 30+ days", "Never made") — data captured in Phase 4; UI deferred until we know if it's useful
- **Subtle "you've rated this" pip on recipe cards** — deferred pending user feedback on the v1 favorites filter
- **Backend `smart_filter` param** — server-side smart-filter logic; currently client-side after smart_sections intersection
- **ActionCable in a separate process** — only if Phase 2 confirms worker starvation
- **External uptime monitoring** — `/health` endpoint + a third-party pinger (UptimeRobot or similar)
- **Share-link analytics** — who's opening a shared recipe, when; only if we want the data
- **Per-household sharing dashboard** — list all recipes you're currently sharing, with copy/revoke controls
