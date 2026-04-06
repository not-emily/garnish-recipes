# Decisions Log - Garnish

## 2026-04-06: Rails API + React PWA Monorepo Architecture

**Decision:** Use a monorepo with `backend/` (Rails 8 API-only) and `frontend/` (React + Vite PWA) rather than a Rails monolith with Hotwire or separate repos.

**Rationale:** The meal planning UI requires rich interactivity (drag-and-drop, swipe gestures, real-time sync) that React handles better than Hotwire. Monorepo keeps everything in one place for a solo developer. API-only Rails is leaner and focused.

**Alternatives Considered:** Rails monolith + Hotwire (less mobile UX flexibility), Next.js full-stack (all JS, no Rails), Go API + React (more work, less Rails magic), separate repos (more overhead for solo dev).

**Impact:** All implementation, CI/CD, and deployment decisions flow from this. Frontend deploys to CF Pages, backend deploys to MacBook server.

---

## 2026-04-06: Self-Hosted on MacBook Pro via Cloudflare Tunnel (No Docker)

**Decision:** Run Rails and PostgreSQL natively on an existing always-on MacBook Pro server. Public access via Cloudflare Tunnel. No Docker.

**Rationale:** Zero monthly hosting cost. Full WebSocket support without free-tier limitations. Docker on macOS adds ~2GB RAM overhead via Linux VM — significant on a shared server. Native deployment is simpler for a single-server setup. CF Tunnel provides security without open ports.

**Alternatives Considered:** Render free tier (no WebSocket, cold starts, 97-day Postgres expiry), Fly.io (cheap but not free long-term), AWS Lightsail (~$20/mo), Docker on Mac (RAM overhead).

**Impact:** Dev environment (Arch Linux) differs from prod (macOS). CI runs tests before deploy to catch issues. Deploy is `git pull + bundle + migrate + restart` via Tailscale SSH from GitHub Actions.

---

## 2026-04-06: Recipes Belong to Households, Export on Leave

**Decision:** Recipes are owned by the household, not individual users. Each recipe tracks `contributed_by` for attribution. Users can export their contributed recipes at any time (meatball menu) and are prompted to export when leaving a household.

**Rationale:** Avoids confusing "personal library vs household library" split. One recipe box per household keeps the daily UX simple. Export-on-leave ensures users don't lose their work. Both parties keep copies after a "split."

**Alternatives Considered:** Personal workspace + household (creates "where does this go?" decision fatigue), recipes owned by users and shared into households (household feels unstable if someone leaves), recipes at household with no export (user loses work on leave).

**Impact:** Recipe collections are user-owned (survive leaving a household) but reference household recipes. Collection references become tombstones on leave, healable if recipes are re-imported elsewhere.

---

## 2026-04-06: LLM Features as Optional Enhancement (BYOK)

**Decision:** All AI/LLM features (recipe ingestion from PDF/image, future smart suggestions) are optional. Users bring their own API keys via sage-rb. The app is fully functional without any AI.

**Rationale:** No ongoing API costs for the developer. Keeps the app accessible to non-technical users. Users who want enhanced features opt in.

**Alternatives Considered:** Developer-funded API keys (ongoing cost for a free app), mandatory LLM for ingestion (poor UX for users without keys).

**Impact:** Recipe ingestion has two paths: JSON-LD parsing (free, no LLM) for URLs, and LLM extraction (user's keys) for PDFs/images. Fallback always stores source material as attachment for manual entry.

---

## 2026-04-06: Meal Plan Entries as Polymorphic Types

**Decision:** Meal plan slots accept multiple entry types: recipe, quick_meal, event, and note. Each slot can hold multiple entries. Quick meals and events are stored as recipe records with `recipe_type` to enable unified browsing.

**Rationale:** Real-life meal planning includes frozen foods, takeout, family dinners out, and leftovers — not just recipes. Unifying quick meals and events as recipe types (with lighter forms) means one browse/search experience. Multiple entries per slot handles real meals (main + side + leftovers).

**Alternatives Considered:** Everything as a recipe (what Notion forced — clunky), separate models for each type (more complex, harder to browse), single entry per slot (doesn't reflect real meals).

**Impact:** The recipe model has a `recipe_type` enum. The meal plan entry picker offers four clear options. Browse page shows all types with filters.

---
