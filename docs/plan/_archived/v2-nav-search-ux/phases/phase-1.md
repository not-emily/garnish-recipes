# Phase 1: Header & Settings Relocation

> **Depends on:** None
> **Enables:** Phase 2 (nav rework needs header in place first)
>
> See: [Full Plan](../plan.md)

## Goal

Create a shared PageHeader component with page title and user avatar icon, and remove Settings from the bottom navigation. Settings becomes accessible via the avatar on main tab pages and the search page.

## Key Deliverables

- `PageHeader` component with title, optional right-side actions, and user avatar linking to `/settings`
- Avatar shows user's first initial in a circle, links to `/settings`
- Avatar visible on main tab pages (Recipes, Meal Plan, Grocery) and the Search page (added later in Phase 3)
- Sub-pages (RecipeDetail, RecipeEdit, RecipeNew, CollectionDetail) retain their existing headers (back button + contextual actions) — no avatar
- Settings removed from `BottomNav` nav items array (but route remains in App.tsx)
- Each main page updated to use `PageHeader` instead of its own `<h1>` + action buttons

## Files to Create

- `frontend/src/components/layout/PageHeader.tsx` — shared header component

## Files to Modify

- `frontend/src/components/layout/BottomNav.tsx` — remove Settings from navItems
- `frontend/src/pages/Recipes.tsx` — replace inline header with `<PageHeader>`
- `frontend/src/pages/MealPlan.tsx` — replace inline header with `<PageHeader>`
- `frontend/src/pages/GroceryList.tsx` — replace inline header with `<PageHeader>`

## Dependencies

**Internal:** None — this is the foundation phase.

**External:** None — uses existing Lucide icons (`User` or `UserCircle`).

## Implementation Notes

### PageHeader Design

```tsx
<PageHeader title="Recipes" showAvatar>
  {/* Optional right-side actions passed as children or actions prop */}
  <ImportButton />
  <AddButton />
</PageHeader>
```

The header layout:
- Left: page title (text-2xl font-bold)
- Right: action buttons (if any) + avatar icon
- Avatar: 32px circle with user initial, bg-gray-100, links to /settings
- The avatar sits to the right of any page-specific action buttons

### Avatar Component

Use `useAuth()` to get the current user's name. Display first letter uppercased in a circle. Tapping navigates to `/settings`.

### Settings Tab Removal

Simply remove the Settings entry from the `navItems` array in `BottomNav.tsx`. The `/settings` route stays in `App.tsx` — it's just no longer in the nav bar.

### Page Updates

Each main page currently has its own header markup (e.g., Recipes has `<h1>Recipes</h1>` + Import/Add buttons). Replace these with `<PageHeader>` for consistency, passing page-specific actions as props/children.

## Validation

- [ ] Settings is no longer in the bottom nav bar
- [ ] User avatar with initial appears in header on Recipes, Meal Plan, and Grocery pages
- [ ] Tapping avatar navigates to Settings page
- [ ] Settings page is still accessible and functional
- [ ] Sub-pages (recipe detail, edit, etc.) do NOT show the avatar header
- [ ] Page-specific actions (Import, Add on Recipes; Generate on Grocery) still appear in header
- [ ] Back navigation from Settings works correctly (browser back)
