# Garnish: Meal Planning for Real Life

> **Status:** Planning complete | Last updated: 2026-04-06
> 
> Phase files: [phases/](phases/)

## Overview

Garnish is a mobile-first meal planning app built for households. It combines recipe management, weekly meal planning, and collaborative grocery lists into a single, polished experience that replaces the patchwork of Notion databases and shared Google Keep lists that most households cobble together.

The app is designed around how people actually plan meals — not everything is a recipe. Frozen foods, takeout nights, family dinners out, and leftovers stretching across multiple days are all first-class citizens in the meal plan. Users can optionally enhance their experience with AI-powered recipe ingestion (URL, PDF, image scanning) by bringing their own LLM API keys, but the app is fully functional without any AI features.

Garnish is multi-tenant from day one. Users sign up, create or join a household, and share recipes, meal plans, and grocery lists with household members. Role-based permissions (owner/admin/member) let families control who can modify what — kids can add milk to the grocery list without accidentally deleting dinner plans. Recipe collections provide a way to curate and share recipes with friends and family outside your household.

## Core Vision

- **Household-first**: Everything revolves around a shared household context. Recipes, meal plans, and grocery lists are collaborative by default.
- **Frictionless input**: Recipes flow in from URLs, photos, PDFs, or manual entry with minimal effort. AI-powered ingestion is available but optional.
- **Flexible meal planning**: Not everything is a recipe. Support real-life patterns: leftovers stretching across days, events, freezer meals, quick meals, and freeform notes.
- **Mobile-native feel**: A PWA that feels like an installed app, not a website you're tolerating. Optimized for phone and tablet, works great on desktop.

## Requirements

### Must Have
- User authentication with JWT tokens
- Household creation, joining via invite, and role-based permissions (owner/admin/member)
- Recipe CRUD with structured ingredients (grouped sections) and instructions
- Recipe types: full recipes, quick meals, and events
- Recipe taxonomy: category, cuisine, tags, primary protein, prep/cook time, difficulty
- Recipe ingestion from URL (JSON-LD parsing), PDF, image, and manual entry
- LLM-powered recipe extraction via sage-rb (optional, user provides API keys)
- Fallback for non-LLM users: store source material (URL/PDF/image) as attachment, user enters details manually
- Weekly meal plan view with breakfast/lunch/dinner slots
- Multiple entries per meal slot
- Leftover calculation with smart suggestions based on household size
- Leftover tray for partial leftover visibility
- Grocery list generation from meal plan with source tracking
- Real-time grocery list sync via WebSocket (ActionCable)
- Recipe collections with visibility (private/household) and cross-household sharing
- Per-member recipe ratings (1-5 stars) with household averages
- Smart browse sections: recently used, favorites, haven't made in a while, never tried, quick meals
- Recipe export (anytime via menu, prompted on household leave)
- PWA with installable app experience
- Configurable household settings (default diners, leftover preferences)
- Configurable member grocery list permissions (read/contribute/full)

### Nice to Have
- Offline grocery list access (service worker caching)
- Cooking mode with step-by-step instructions and timers
- Recipe scaling (adjust servings, recalculate ingredients)
- Smart LLM suggestions (meal plan ideas, ingredient deduplication)
- Social auth (Google, Apple)
- Public recipe collections / discover feed
- Multiple household support per user (switcher)
- Automated Postgres backups to Cloudflare R2/Backblaze B2

### Out of Scope
- Native mobile apps (iOS/Android) — PWA is the mobile strategy
- Nutritional information / calorie tracking — different problem space
- Pantry/inventory management — too much overhead for v1
- Meal delivery or ingredient delivery integration
- Social features beyond collection sharing (comments, feeds, following)
- Monetization features — this is a personal/friends-and-family app

## Constraints

- **Timeline**: Side project, built in off-hours. No hard deadline.
- **Team**: Solo developer (Emily), Arch Linux development environment.
- **Budget**: Minimal ongoing costs. Self-hosted backend on existing MacBook Pro server.
- **Hosting**: Backend on MacBook Pro (always-on home server) via Cloudflare Tunnel. Frontend on Cloudflare Pages (free). No cloud compute costs.
- **Network**: MacBook server on Tailscale network. Public access via Cloudflare Tunnel (no open ports). No VLAN — CF Tunnel + Docker isolation provides security boundary.
- **Compatibility**: Must work across iPhone and Android (PWA), tablet, and desktop. Mobile/tablet prioritized.

## Success Metrics

- **Core loop works**: User can add a recipe, plan a week of meals (including leftovers, quick meals, events), generate a grocery list, and shop from it — all from their phone.
- **Household collaboration**: Two household members can simultaneously use the grocery list with real-time sync.
- **Recipe ingestion**: URL import successfully parses 80%+ of recipe blog URLs via JSON-LD without LLM. LLM fallback handles the rest for users with API keys.
- **Onboarding**: A new user can sign up, create/join a household, and add their first recipe in under 2 minutes.
- **Performance**: Pages load in under 1 second on mobile (after initial PWA cache). Cold start (server wake) handled gracefully with branded loading screen.

## Architecture Decisions

### 1. Rails API + React PWA (Monorepo)
**Choice:** Separate Rails API backend and React single-page app frontend in a single monorepo (`backend/` + `frontend/`).
**Rationale:** The meal planning UI (drag-and-drop calendar, swipeable lists, real-time grocery sync) demands React-level interactivity. Rails provides rapid backend development with built-in auth patterns, background jobs, and WebSocket support. Monorepo keeps everything in one place for a solo developer.
**Trade-offs:** Two build systems to maintain. More complexity than a Rails monolith with Hotwire. Worth it for the mobile UX.

### 2. Self-Hosted on MacBook Pro via Cloudflare Tunnel
**Choice:** Run the Rails API and PostgreSQL natively on an existing always-on MacBook Pro. Public access via Cloudflare Tunnel. Frontend on Cloudflare Pages.
**Rationale:** Zero monthly hosting cost. Full WebSocket support (no free-tier limitations). Full control over the environment. CF Tunnel exposes only the configured service — no open ports, home IP hidden.
**Trade-offs:** Ops responsibility (updates, backups, uptime). MacBook must stay on and connected. Mitigated by automated backups and the simplicity of the native setup.

### 3. Native Deployment (No Docker)
**Choice:** Run Rails and PostgreSQL natively via Homebrew on macOS. No containerization.
**Rationale:** Docker on macOS runs inside a Linux VM, consuming 1-2GB RAM overhead. Native saves significant resources on a shared server machine. Deploy is simple: git pull, bundle install, migrate, restart.
**Trade-offs:** Dev (Arch Linux) and prod (macOS) environments differ. Mitigated by CI running tests before deploy, and Ruby/Postgres being cross-platform. If moving to a Linux server later, Docker can be added then.

### 4. PostgreSQL with JSONB for Recipe Data
**Choice:** Store recipe ingredients and instructions as structured JSONB columns rather than fully normalized relational tables.
**Rationale:** Ingredient structure varies wildly (sections, optional fields, preparation notes). JSONB allows evolving the schema without migrations. PostgreSQL JSONB supports indexing and querying.
**Trade-offs:** Less relational purity. Harder to query individual ingredients across recipes (e.g., "all recipes with chicken"). Mitigated by also storing searchable fields (category, tags, primary_protein) as regular columns.

### 5. GoodJob for Background Processing
**Choice:** GoodJob (Postgres-backed) instead of Sidekiq (Redis-backed).
**Rationale:** Eliminates the need for a separate Redis instance. One fewer service to run and maintain. GoodJob runs inside the Rails process — no separate worker needed for low-volume workloads like recipe ingestion.
**Trade-offs:** Less performant than Sidekiq at scale. Not a concern at this scale (dozens of users, occasional recipe imports).

### 6. LLM Features as Optional Enhancement
**Choice:** All AI/LLM features (recipe ingestion from PDF/image, smart suggestions) are optional. Users bring their own API keys via sage-rb. The app is fully functional without any AI.
**Rationale:** No ongoing API costs for the developer. Users who want enhanced features opt in. Keeps the app accessible to non-technical users who don't want to set up API keys.
**Trade-offs:** Users without API keys get a degraded ingestion experience (manual entry with source attachments as reference). The core app loop (recipes, planning, grocery) works identically regardless.

### 7. Tailscale + GitHub Actions for CI/CD
**Choice:** GitHub Actions runs tests on push. Backend deploys via SSH through Tailscale to the MacBook server. Frontend auto-deploys to CF Pages.
**Rationale:** Tailscale provides secure SSH access without exposing ports. GitHub Actions is free for public repos and has generous free minutes for private repos. Path-filtered workflows ensure only relevant changes trigger deploys.
**Trade-offs:** Requires a Tailscale ephemeral auth key in GitHub Secrets. Deploy depends on the MacBook being reachable via Tailscale.

### 8. ActionCable for Real-Time Sync
**Choice:** ActionCable (Rails built-in WebSocket) for real-time grocery list and meal plan updates.
**Rationale:** Built into Rails, no additional dependencies. Self-hosted server supports persistent WebSocket connections (no free-tier limitations). Critical for the grocery list shopping experience (two people in a store seeing the same list).
**Trade-offs:** ActionCable uses Redis by default for pub/sub. Can use the `async` adapter for single-server deployment (which this is), avoiding Redis entirely.

## Project Structure

```
garnish/
├── backend/                       # Rails API (api-only mode)
│   ├── app/
│   │   ├── controllers/api/v1/   # Versioned API controllers
│   │   ├── models/               # ActiveRecord models
│   │   ├── jobs/                 # Background jobs (GoodJob)
│   │   ├── services/             # Business logic
│   │   │   └── recipe_ingestion/ # URL, PDF, image parsers
│   │   ├── channels/             # ActionCable channels
│   │   ├── policies/             # Pundit authorization
│   │   └── serializers/          # JSON response shaping
│   ├── config/
│   ├── db/
│   ├── Gemfile
│   └── ...
│
├── frontend/                      # React PWA
│   ├── public/                   # PWA manifest, icons
│   ├── src/
│   │   ├── api/                  # API client layer
│   │   ├── components/           # UI components by domain
│   │   │   ├── ui/               # Shared primitives
│   │   │   ├── recipes/          # Recipe components
│   │   │   ├── meal-plan/        # Meal planning components
│   │   │   ├── grocery/          # Grocery list components
│   │   │   ├── household/        # Household management
│   │   │   └── layout/           # App shell, nav
│   │   ├── hooks/                # Custom React hooks
│   │   ├── pages/                # Route-level components
│   │   ├── contexts/             # React contexts (auth, household)
│   │   ├── types/                # TypeScript type definitions
│   │   └── service-worker.ts     # Workbox PWA config
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── .github/
│   └── workflows/                # CI/CD pipelines
│       ├── test.yml              # Run tests on all branches
│       ├── deploy-backend.yml    # Deploy backend on main (backend/ changes)
│       └── deploy-frontend.yml   # Deploy frontend on main (frontend/ changes)
│
├── docs/
│   └── plan/                     # Project plan (this document)
└── README.md
```

### Key Files
- `backend/app/services/recipe_ingestion/` — The ingestion pipeline. Each parser is its own class. LLM extraction is optional (only called if user has API keys).
- `backend/app/policies/` — Pundit authorization. Every action checks household membership and role permissions.
- `frontend/src/api/client.ts` — Single point for all API communication. Handles JWT refresh, error handling, WebSocket connection.
- `frontend/src/components/layout/AppShell.tsx` — Mobile app shell with bottom nav. Every page renders inside this.

## Core Interfaces

### API Response Shape

```json
// Success
{
  "data": {},
  "meta": { "total": 100, "page": 1, "per_page": 20 }
}

// Error
{
  "error": {
    "code": "validation_failed",
    "message": "Recipe title can't be blank",
    "details": { "title": ["can't be blank"] }
  }
}
```

### API Endpoints

```
/api/v1/
├── /auth
│   ├── POST   /signup
│   ├── POST   /login
│   └── DELETE /logout
├── /households
│   ├── POST   /                    (create)
│   ├── GET    /current              (active household)
│   ├── PATCH  /current              (update settings)
│   ├── POST   /current/invite       (invite member)
│   ├── POST   /join                 (join via invite code)
│   ├── GET    /current/members
│   └── PATCH  /current/members/:id  (update role/permissions)
├── /recipes
│   ├── GET    /                    (index, search, filter)
│   ├── POST   /                    (create)
│   ├── GET    /:id
│   ├── PATCH  /:id
│   ├── DELETE /:id
│   ├── POST   /import              (URL/PDF/image ingestion)
│   ├── POST   /export              (bulk export)
│   └── POST   /:id/rate            (rate recipe)
├── /meal_plans
│   ├── GET    /?week=2026-04-06    (get week's plan)
│   ├── POST   /entries              (add entry to slot)
│   ├── PATCH  /entries/:id
│   ├── DELETE /entries/:id
│   └── GET    /leftovers            (available leftover tray)
├── /grocery_lists
│   ├── GET    /current              (current active list)
│   ├── POST   /generate             (from meal plan)
│   ├── POST   /items                (manual add)
│   ├── PATCH  /items/:id            (check off, edit)
│   └── DELETE /items/:id
└── /collections
    ├── GET    /                    (my collections)
    ├── POST   /
    ├── GET    /:id
    ├── PATCH  /:id
    ├── DELETE /:id
    ├── POST   /:id/recipes          (add recipe to collection)
    ├── DELETE /:id/recipes/:recipe_id
    └── POST   /:id/share
```

All household-scoped endpoints implicitly scope to the user's active household. No household ID in the URL.

### WebSocket Channels

```
GroceryListChannel — subscribes to active household's current grocery list
  Broadcasts: item_added, item_checked, item_removed, item_updated

MealPlanChannel — subscribes to active household's current week meal plan
  Broadcasts: entry_added, entry_updated, entry_removed
```

### Key TypeScript Types

```typescript
type RecipeType = 'full' | 'quick_meal' | 'event';
type RecipeCategory = 'entree' | 'side' | 'appetizer' | 'soup_stew' | 'salad' |
                      'breakfast' | 'dessert' | 'snack' | 'beverage' | 'sauce_dressing';
type MealSlot = 'breakfast' | 'lunch' | 'dinner';
type HouseholdRole = 'owner' | 'admin' | 'member';
type GroceryPermission = 'read' | 'contribute' | 'full';
type EntryType = 'recipe' | 'quick_meal' | 'event' | 'note';
type GrocerySourceType = 'recipe' | 'quick_meal' | 'manual';

interface Recipe {
  id: string;
  recipe_type: RecipeType;
  title: string;
  description?: string;
  category: RecipeCategory;
  cuisine?: string;
  tags: string[];
  primary_protein?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings: number;
  source_url?: string;
  image_url?: string;
  ingredient_groups: IngredientGroup[];
  instructions: InstructionStep[];
  average_rating?: number;
  rating_count: number;
  my_rating?: number;
  last_cooked_at?: string;
  times_cooked: number;
  contributed_by: string;
  notes?: string;
  attachments: Attachment[];
}

interface IngredientGroup {
  label?: string;
  ingredients: Ingredient[];
}

interface Ingredient {
  name: string;
  quantity?: number;
  unit?: string;
  preparation?: string;
  optional: boolean;
}

interface InstructionStep {
  step: number;
  text: string;
  timer_minutes?: number;
}

interface MealPlanEntry {
  id: string;
  date: string;
  meal_slot: MealSlot;
  entry_type: EntryType;
  recipe?: Recipe;
  title: string;
  servings_override?: number;
  diners_override?: number;
  is_leftover: boolean;
  leftover_of_id?: string;
  leftover_servings?: number;
  include_in_grocery: boolean;
  position: number;
}

interface GroceryListItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category: string;
  source_type: GrocerySourceType;
  source_entries: { id: string; title: string }[];
  checked: boolean;
  added_by: { id: string; name: string };
}
```

## Implementation Phases

| Phase | Name | Scope | Depends On | Key Outputs |
|-------|------|-------|------------|-------------|
| 1 | Foundation | Rails API + React app + auth + CI/CD + deployment | — | Running app with login, deployed via CF Tunnel |
| 2 | Households | Household CRUD, memberships, invites, roles, onboarding | Phase 1 | Users can create/join households |
| 3 | Recipes Core | Recipe model, CRUD, ingredient/instruction editor, browse/search, taxonomy | Phase 2 | Full recipe management with browse |
| 4 | Recipe Ingestion | URL/PDF/image import, JSON-LD parsing, sage-rb LLM (optional), background jobs | Phase 3 | Import recipes from external sources |
| 5 | Meal Planning | Weekly view, meal slots, multiple entries, quick meals, events, notes | Phase 3 | Functional meal planner |
| 6 | Leftovers | Leftover calculation, prompts, leftover tray, household preferences | Phase 5 | Smart leftover management |
| 7 | Grocery Lists | Generation from meal plan, source tracking, manual items, check-off, real-time sync | Phase 5 | Collaborative grocery lists |
| 8 | Collections & Sharing | Recipe collections, visibility, sharing, export | Phase 3 | Collection management |
| 9 | Ratings & Smart Browse | Per-member ratings, averages, smart browse sections | Phase 3 | Enhanced recipe discovery |
| 10 | Polish & PWA | Service worker, install prompt, loading states, animations, mobile refinement | Phase 7 | Production-ready PWA |

### Critical Path
```
Phase 1 → Phase 2 → Phase 3 → Phase 5 → Phase 7
(foundation → households → recipes → meal plan → grocery)
```

This is the MVP path. Phases 4, 6, 8, 9 can be built in any order after their dependencies are met. Phase 10 is last but informs design decisions throughout.

### Parallelizable after Phase 3
- Phase 4 (ingestion), Phase 8 (collections), Phase 9 (ratings) are independent
- Phase 6 (leftovers) requires Phase 5 (meal planning)
- Phase 10 (polish) comes after Phase 7 (grocery) to ensure the full loop is polished

### Phase Details
- [Phase 1: Foundation](phases/phase-1.md)
- [Phase 2: Households](phases/phase-2.md)
- [Phase 3: Recipes Core](phases/phase-3.md)
- [Phase 4: Recipe Ingestion](phases/phase-4.md)
- [Phase 5: Meal Planning](phases/phase-5.md)
- [Phase 6: Leftovers](phases/phase-6.md)
- [Phase 7: Grocery Lists](phases/phase-7.md)
- [Phase 8: Collections & Sharing](phases/phase-8.md)
- [Phase 9: Ratings & Smart Browse](phases/phase-9.md)
- [Phase 10: Polish & PWA](phases/phase-10.md)

## Tech Stack

| Category | Choice | Notes |
|----------|--------|-------|
| Language (backend) | Ruby | Rails ecosystem, rapid development |
| Framework (backend) | Rails 8 (API-only) | Auth, jobs, WebSocket, ActiveRecord |
| Language (frontend) | TypeScript | Type safety across the React app |
| Framework (frontend) | React 19 + Vite | Fast builds, SPA/PWA, rich interactivity |
| Routing (frontend) | React Router | Client-side routing for SPA feel |
| State management | TanStack Query | Server state caching, background refetch |
| Styling | Tailwind CSS | Mobile-first utilities, consistent design |
| Animation | Framer Motion | Native-feeling transitions and interactions |
| Database | PostgreSQL 16 | JSONB for flexible recipe data, rock solid |
| Background jobs | GoodJob | Postgres-backed, no Redis needed |
| WebSocket | ActionCable (async adapter) | Built into Rails, single-server friendly |
| LLM integration | sage-rb | Unified LLM adapter, user-provided API keys |
| Auth | Custom user model + JWT | Existing user model, token-based API auth |
| Authorization | Pundit | Policy-based, clean role/permission checks |
| File storage | ActiveStorage → Cloudflare R2 | Recipe images, PDF/image attachments |
| PWA | Workbox | Service worker, caching, install prompt |
| CI/CD | GitHub Actions | Tests on push, deploy on merge to main |
| Hosting (backend) | MacBook Pro (self-hosted) | Native Rails + Postgres via Homebrew |
| Hosting (frontend) | Cloudflare Pages | Free, auto-deploy from monorepo |
| Tunnel | Cloudflare Tunnel (cloudflared) | Secure public access, no open ports |
| Network | Tailscale | Secure SSH for dev access and CI/CD deploys |

## Future Considerations

Items explicitly deferred from scope but architecturally supported:

- **Offline PWA support** — Service worker caching for grocery list offline access. Data layer designed to be sync-friendly.
- **Cooking mode** — Step-by-step instruction view with timers. `timer_minutes` field in instruction steps supports this.
- **Recipe scaling** — Adjust servings and recalculate ingredient quantities. Structured ingredient data (quantity/unit) supports this.
- **Smart LLM suggestions** — Meal plan ideas based on history, ingredient deduplication, recipe recommendations. Optional enhancement path.
- **Multiple households per user** — Household switcher in nav. Data model supports multiple memberships already.
- **Public collections / discover** — Share collections publicly, browse other users' collections. `visibility` field supports this.
- **Social auth** — OmniAuth providers (Google, Apple). Can be added alongside existing JWT auth.
- **Automated backups** — Cron job to dump Postgres and push to Cloudflare R2 or Backblaze B2 (both have free tiers).
