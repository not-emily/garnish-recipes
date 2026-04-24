# Phase 1: Connection Resilience & Honest UI

> **Depends on:** None
> **Enables:** Phases 3 and 4 use the mutation/optimistic patterns established here
>
> See: [Full Plan](../plan.md)

## Goal

Make every failure state legible. Introduce a consistent error taxonomy in the API client, ensure only real 401s clear auth, surface server-unreachable events through the existing `OfflineBanner`, enforce pending/error states on every mutation, and provide a shared optimistic-update helper so ghost-state bugs become architecturally impossible. Fixes the "random logout", grocery ghost-item, duplicate-submit, and "recently made" sort bugs along the way.

## Key Deliverables

### Sub-phase 1A — API Client & Error Taxonomy
- `ApiError` class with `category: "auth" | "client" | "transient" | "offline"`
- Interceptor classifies every response/error into one of the four categories
- 401 → clear tokens + redirect to sign-in + toast "Session expired"
- 5xx / timeouts / network errors → keep session, throw typed `ApiError`, do **not** redirect
- Queries auto-retry on transient errors with exponential backoff (max 3 attempts, configured via TanStack Query defaults)
- Mutations never auto-retry; errors bubble to call site with a manual retry affordance

### Sub-phase 1B — Connection State & Banners
- `connectionState.ts` module tracks: online/offline (from `navigator.onLine`), last-server-response timestamp, consecutive transient-error count, ActionCable connection status
- `OfflineBanner` expanded: shows when (a) `navigator.onLine === false`, (b) N consecutive transient failures in a short window, or (c) ActionCable has been disconnected > 10s
- Banner is unobtrusive but persistent — top of screen, auto-dismisses when connectivity recovers
- New `ConnectionIndicator` component: small pill showing "Reconnecting…" when cable is down but HTTP is fine (so users know realtime updates are paused)
- Remove the current generic "oops we encountered an error" full-screen error page for transient errors — it now shows inline retry affordances instead

### Sub-phase 1C — Shared Optimistic-Update Helper
- `useOptimisticMutation<TVariables, TData>` hook wraps TanStack Query's `useMutation` with:
  - Optimistic cache update via `onOptimisticUpdate` callback
  - Automatic rollback via `onRollback` on failure
  - Pending visual (fade or dot) applied to the affected cache entries
  - Invalidation of related query keys on success
  - Error toast with retry action on failure
- Migrate the grocery list mutations (add, check, uncheck, delete) to the helper
- Migrate recipe rating mutation to the helper
- New mutations automatically adopt the pattern

### Sub-phase 1D — Mutation Button States
- Audit every `<button>` that triggers a mutation. Each must:
  - Show a spinner when pending
  - Disable click handling while pending
  - Display error state inline or via toast with retry
- Create a `<MutationButton>` wrapper component to enforce this consistently
- Key targets: add-grocery-item form, add-recipe, save-recipe-edit, add-to-meal-plan, rating stars, collection add/remove, import

### Sub-phase 1E — Targeted Bug Fixes
- **Grocery ghost items**: audit `useGroceryList` for paths that produce items with partial state; audit `GroceryListChannel` broadcast handlers for payloads missing fields; ensure pull-to-refresh invalidates the full query cache, not just local component state
- **Add-grocery-item form**: after successful submit, clear the input and keep focus; pending state from 1D prevents duplicate submits
- **Recently-made sort**: fix backend controller / query where `sort=recently_cooked` falls through to `updated_at`; verify `last_cooked_at` column exists and is populated (ties to Phase 4 tally job — if currently `MealPlanEntry#after_commit` on create is updating it, sort works for now; correct semantics in Phase 4)

## Files to Create

- `frontend/src/lib/useOptimisticMutation.ts` — shared optimistic-mutation hook
- `frontend/src/lib/connectionState.ts` — connection status module (online, cable, transient-error count)
- `frontend/src/components/layout/ConnectionIndicator.tsx` — "Reconnecting…" pill for cable disconnects
- `frontend/src/components/ui/MutationButton.tsx` — button wrapper enforcing pending/error states

## Files to Modify

- `frontend/src/lib/api.ts` — rewrite error handling; introduce `ApiError` taxonomy; remove aggressive logout-on-any-error
- `frontend/src/lib/auth.ts` (or wherever the logout-on-401 interceptor currently lives) — restrict to category === "auth"
- `frontend/src/components/layout/OfflineBanner.tsx` — expand trigger conditions (transient failures, cable disconnect)
- `frontend/src/App.tsx` or root — integrate connection state provider if needed
- `frontend/src/hooks/useGroceryList.ts` — audit for ghost-producing paths; migrate to `useOptimisticMutation`
- `frontend/src/components/grocery/AddGroceryItemForm.tsx` — pending state + clear on success
- `frontend/src/components/grocery/GroceryListChannel.ts` (or wherever cable handlers live) — audit broadcast payload handling, guard against partial writes to cache
- `frontend/src/components/recipes/RecipeBrowser.tsx` (and any sort param call sites) — ensure `sort=recently_cooked` is passed and honored
- `backend/app/controllers/api/v1/recipes_controller.rb` — verify `sort=recently_cooked` param maps to `order(last_cooked_at: :desc)` with null-last handling; add if missing
- Any other call site with ad-hoc 401 handling or manual retry logic — consolidate into the new helpers

## Dependencies

**Internal:** None — this is the foundation of the plan.

**External:** None — TanStack Query already provides the retry infrastructure; we're configuring it, not replacing it.

## Implementation Notes

### Error Taxonomy Shape

```typescript
// frontend/src/lib/api.ts

export type ApiErrorCategory = "auth" | "client" | "transient" | "offline";

export class ApiError extends Error {
  category: ApiErrorCategory;
  status: number | null;
  retryable: boolean;
  originalError: unknown;

  constructor(opts: {
    category: ApiErrorCategory;
    status: number | null;
    message: string;
    retryable: boolean;
    originalError: unknown;
  }) {
    super(opts.message);
    this.category = opts.category;
    this.status = opts.status;
    this.retryable = opts.retryable;
    this.originalError = opts.originalError;
  }
}

function classify(err: unknown): ApiError {
  if (!navigator.onLine) return new ApiError({ category: "offline", ... });
  // If fetch threw (network error) or response is 5xx or 408/504: transient, retryable
  // If 401: auth, not retryable at interceptor layer (user must re-auth)
  // If other 4xx: client, not retryable
}
```

### Auth Interceptor Fix

The current code path (wherever it lives — likely `api.ts` or an axios interceptor / fetch wrapper) probably looks something like:

```typescript
// BEFORE (suspected)
if (response.status >= 400) {
  clearAuth();
  window.location.href = "/login";
}
```

Replace with:

```typescript
// AFTER
const err = classify(response);
if (err.category === "auth") {
  clearAuth();
  toast("Session expired — please sign in again");
  window.location.href = "/login";
}
throw err;  // call sites decide how to handle the rest
```

### OfflineBanner Trigger Logic

```typescript
// connectionState.ts
const TRANSIENT_THRESHOLD = 3;      // N failures within window = "server unreachable"
const TRANSIENT_WINDOW_MS = 15_000;
const CABLE_DISCONNECT_THRESHOLD_MS = 10_000;

// Banner shows when:
// - !navigator.onLine  → "You're offline"
// - transientErrorCount >= THRESHOLD within WINDOW  → "Can't reach server — retrying…"
// - cable disconnected > THRESHOLD_MS  → "Reconnecting to live updates…" (lighter-weight indicator)
```

Keep the banner visually subtle — a 1-line strip at the top with an icon and text. No blocking overlays. Auto-dismiss on recovery.

### useOptimisticMutation Sketch

```typescript
export function useOptimisticMutation<TVars, TData>(opts: {
  mutationFn: (vars: TVars) => Promise<TData>;
  onOptimisticUpdate: (vars: TVars, queryClient: QueryClient) => void;
  onRollback: (vars: TVars, queryClient: QueryClient) => void;
  invalidateKeys?: QueryKey[];
  errorToast?: (err: ApiError) => string;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: opts.mutationFn,
    onMutate: (vars) => opts.onOptimisticUpdate(vars, qc),
    onError: (err, vars) => {
      opts.onRollback(vars, qc);
      if (err instanceof ApiError && opts.errorToast) {
        toast.error(opts.errorToast(err), { action: { label: "Retry", onClick: () => /* refire */ } });
      }
    },
    onSettled: () => {
      opts.invalidateKeys?.forEach(key => qc.invalidateQueries({ queryKey: key }));
    },
  });
}
```

Call sites become small:

```typescript
const addItem = useOptimisticMutation({
  mutationFn: (name: string) => api.post(`/grocery_lists/${id}/items`, { name }),
  onOptimisticUpdate: (name, qc) => {
    qc.setQueryData(["grocery-list", id], (old) => ({
      ...old,
      items: [...old.items, { id: `tmp-${Date.now()}`, name, pending: true }]
    }));
  },
  onRollback: (name, qc) => {
    qc.setQueryData(["grocery-list", id], (old) => ({
      ...old,
      items: old.items.filter(i => !i.id.startsWith("tmp-"))
    }));
  },
  invalidateKeys: [["grocery-list", id]],
  errorToast: () => "Couldn't add item — tap to retry",
});
```

### Grocery Ghost Audit Checklist

Likely causes, in priority order:
1. ActionCable `broadcast_append` or similar emits a partial payload that the client merges into cache, producing an item with no `name` or `checked` fields
2. Optimistic add creates a temp item without some required display field, and the real response merge leaves a gap
3. Pull-to-refresh re-fetches the list but doesn't clear existing optimistic/partial state from TanStack Query's cache — only a route remount clears it

Fixes:
- Validate cable payload shape before merging into cache; drop invalid entries with a warning
- Ensure the cable update path uses the same data shape as the REST response
- Pull-to-refresh calls `queryClient.invalidateQueries` **and** `queryClient.resetQueries` if optimistic state is held separately

### MutationButton Component

```tsx
<MutationButton
  onClick={() => addItem.mutate(name)}
  pending={addItem.isPending}
  disabled={!name.trim()}
>
  Add
</MutationButton>
```

The component renders a spinner when `pending`, disables all click handling while pending, and can optionally accept an `errorState` prop. Forbid calling `onClick` multiple times even if the user spams the button (idempotency guard at the component layer).

## Validation

- [ ] Simulated 500 from backend: session survives, toast or banner appears, retry works
- [ ] Simulated network drop (dev tools offline): banner appears, queries pause, mutations show retry toast on failure
- [ ] Simulated 401: session clears, redirect to sign-in, toast reads "Session expired"
- [ ] Rapid-tap grocery add button: no duplicate entries are created (button disables while pending)
- [ ] After successful grocery add: form clears, focus stays in input
- [ ] ActionCable forcibly disconnected: `ConnectionIndicator` shows "Reconnecting…"; auto-recovers
- [ ] Pull-to-refresh on grocery list clears any ghost/partial items
- [ ] `sort=recently_cooked` parameter is sent by the recipe list and honored by the backend
- [ ] No call site still redirects to login on a 500 or network error
- [ ] TanStack Query retries GET requests but not POST/PATCH/DELETE
- [ ] Grocery list mutations use `useOptimisticMutation` and rollback cleanly on forced failure
