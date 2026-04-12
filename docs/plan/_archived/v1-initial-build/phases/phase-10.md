# Phase 10: Polish & PWA

> **Depends on:** Phase 7 (grocery lists — the full core loop must be complete)
> **Enables:** Production-ready launch
>
> See: [Full Plan](../plan.md)

## Goal

Polish the app for production use. Implement PWA features (service worker, install prompt, app manifest), refine mobile UX with animations and transitions, add loading states, and ensure the entire experience feels like a native app.

## Key Deliverables

- PWA manifest and service worker (Workbox)
- App install prompt
- Offline app shell caching (pages load without network)
- Branded loading screen for cold starts
- Page transition animations
- Pull-to-refresh on mobile
- Swipe gestures (grocery check-off, meal plan navigation)
- Error states and empty states
- Responsive polish across phone/tablet/desktop
- Performance optimization (lazy loading, image optimization)

## Files to Create

### Frontend
- `frontend/public/manifest.json` — PWA manifest (name, icons, theme color, display: standalone)
- `frontend/public/icons/` — App icons at various sizes (192, 512, maskable)
- `frontend/src/service-worker.ts` — Workbox service worker configuration
- `frontend/src/components/ui/InstallPrompt.tsx` — PWA install banner
- `frontend/src/components/ui/PullToRefresh.tsx` — Pull-to-refresh wrapper
- `frontend/src/components/ui/EmptyState.tsx` — Reusable empty state component
- `frontend/src/components/ui/ErrorBoundary.tsx` — Error boundary with friendly UI
- `frontend/src/components/ui/Skeleton.tsx` — Loading skeleton components
- `frontend/src/components/layout/PageTransition.tsx` — Animated page transitions

## Dependencies

**Internal:** All previous phases (this is the final polish pass)

**External:**
- `workbox-webpack-plugin` or `vite-plugin-pwa` — Service worker generation
- `framer-motion` — Animations (already added in Phase 5)

## Implementation Notes

### PWA Manifest

```json
{
  "name": "Garnish",
  "short_name": "Garnish",
  "description": "Meal planning for real life",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#...",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`display: standalone` removes browser chrome — the app looks native when installed.

### Service Worker Strategy

Using Workbox with these caching strategies:

| Resource | Strategy | Rationale |
|----------|----------|-----------|
| App shell (HTML, JS, CSS) | Cache-first, update in background | Fast loads, auto-updates |
| API responses | Network-first, fall back to cache | Fresh data preferred, cached data as fallback |
| Images (recipe photos) | Cache-first, long TTL | Images rarely change |
| Fonts | Cache-first | Never change |

This gives us:
- **Instant app loads** after first visit (shell is cached)
- **Grocery list available offline** (last cached version) — read-only, but visible
- **Graceful degradation** when offline: show cached data with an "offline" indicator

### Loading States

Every page and data-dependent component needs three states:
1. **Loading**: Skeleton UI (not spinners — skeletons feel faster)
2. **Empty**: Friendly illustration + call to action ("No recipes yet. Add your first!")
3. **Error**: Friendly message + retry button

### Cold Start Handling

The MacBook server may occasionally be slow to respond (not a cold start like Render, but network hiccups happen):
- API client has a timeout (10s)
- If the first request is slow, show the branded loading screen
- The loading screen should feel intentional, not broken — logo animation, subtle progress indicator
- Service worker ensures the app shell loads instantly even if the API is slow

### Mobile Gestures

- **Swipe right on grocery item** → check off
- **Swipe left on grocery item** → delete (with confirmation for non-owner/admin)
- **Swipe left/right on meal plan** → navigate days (mobile portrait view)
- **Pull to refresh** → reload current data
- **Long press on meal entry** → enter reorder mode

### Animation Guidelines

Keep animations subtle and purposeful:
- Page transitions: 200ms slide or fade
- List item additions: 150ms fade-in
- Check-off: satisfying strike-through + color change
- Modal/bottom sheet: spring animation from bottom
- No animation should delay the user or feel like it's "in the way"

### Performance

- **Lazy load routes**: Only load page components when navigated to
- **Image optimization**: Serve recipe images in WebP, use `loading="lazy"`, responsive srcset
- **Bundle splitting**: Vite auto-splits, but ensure large dependencies (framer-motion, dnd-kit) are in separate chunks
- **TanStack Query**: Stale-while-revalidate for all data — show cached data immediately, refresh in background

### Responsive Breakpoints

```
Phone portrait:   < 640px   — single column, bottom nav, swipe navigation
Phone landscape:  < 768px   — two columns where applicable
Tablet:           768-1024px — sidebar nav option, multi-column layouts
Desktop:          > 1024px   — full layouts, hover states, keyboard shortcuts
```

### Accessibility

- All interactive elements are keyboard-navigable
- Proper ARIA labels on custom controls (star rating, checkboxes)
- Color contrast meets WCAG AA
- Screen reader support for real-time updates (aria-live regions for grocery list changes)

## Validation

How do we know this phase is complete?

- [ ] App can be installed as a PWA on iOS, Android, and desktop
- [ ] Installed app shows no browser chrome (standalone display)
- [ ] App shell loads instantly from service worker cache
- [ ] Offline: cached data is viewable, "offline" indicator shown
- [ ] Loading states use skeleton UI, not spinners
- [ ] Empty states have friendly illustrations and CTAs
- [ ] Error states show friendly messages with retry options
- [ ] Page transitions are smooth (200ms)
- [ ] Grocery list: swipe to check off works on mobile
- [ ] Meal plan: swipe to navigate days works on mobile
- [ ] Pull-to-refresh works on all data pages
- [ ] Images are optimized (WebP, lazy loading, responsive)
- [ ] Bundle is code-split and lazy-loaded per route
- [ ] App looks and feels native on phone, tablet, and desktop
- [ ] Accessibility: keyboard navigation, ARIA labels, color contrast pass
