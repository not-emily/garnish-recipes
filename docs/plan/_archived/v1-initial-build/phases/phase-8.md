# Phase 8: Collections & Sharing

> **Depends on:** Phase 3 (recipes)
> **Enables:** Cross-household recipe sharing
>
> See: [Full Plan](../plan.md)

## Goal

Implement recipe collections — user-owned curated lists of recipes that can be private or shared with the household. Collections provide the mechanism for organizing recipes beyond taxonomy and for sharing recipes with friends and family outside your household.

## Key Deliverables

- Recipe collection CRUD
- Add/remove recipes to/from collections
- Collection visibility: private (just me) or household (shared with household)
- Share collections with users outside the household (view + copy)
- Copy recipes from a shared collection into your own household
- Recipe export (anytime via meatball menu, bulk from collections)

## Files to Create

### Backend
- `backend/app/models/recipe_collection.rb` — Collection model
- `backend/app/models/collection_recipe.rb` — Join table (collection ↔ recipe)
- `backend/app/models/collection_share.rb` — Sharing records
- `backend/app/controllers/api/v1/collections_controller.rb` — CRUD, share
- `backend/app/controllers/api/v1/collection_recipes_controller.rb` — Add/remove recipes
- `backend/app/policies/collection_policy.rb` — Authorization
- `backend/app/serializers/collection_serializer.rb`
- `backend/db/migrate/*_create_recipe_collections.rb`
- `backend/db/migrate/*_create_collection_recipes.rb`
- `backend/db/migrate/*_create_collection_shares.rb`

### Frontend
- `frontend/src/pages/Collections.tsx` — Collections list page
- `frontend/src/pages/CollectionDetail.tsx` — View collection with recipes
- `frontend/src/components/collections/CollectionCard.tsx` — Collection in list view
- `frontend/src/components/collections/CollectionForm.tsx` — Create/edit collection
- `frontend/src/components/collections/ShareModal.tsx` — Share collection with others
- `frontend/src/components/collections/AddToCollectionModal.tsx` — Add recipe to collection (from recipe detail)
- `frontend/src/api/collections.ts` — API client

## Dependencies

**Internal:** Phase 3 (recipe model, recipe detail page)

**External:** None

## Implementation Notes

### Data Model

```ruby
create_table :recipe_collections do |t|
  t.references :user, null: false, foreign_key: true  # owner
  t.references :household, null: false, foreign_key: true  # context
  t.string :name, null: false
  t.text :description
  t.string :visibility, null: false, default: 'private'  # private, household
  t.timestamps
end

create_table :collection_recipes do |t|
  t.references :recipe_collection, null: false, foreign_key: true
  t.references :recipe, null: false, foreign_key: true
  t.integer :position
  t.timestamps
  t.index [:recipe_collection_id, :recipe_id], unique: true
end

create_table :collection_shares do |t|
  t.references :recipe_collection, null: false, foreign_key: true
  t.references :shared_with, null: false, foreign_key: { to_table: :users }
  t.string :permission, default: 'view'  # view, copy
  t.timestamps
  t.index [:recipe_collection_id, :shared_with_id], unique: true
end
```

### Visibility Rules

| Visibility | Who can see | Who can edit |
|-----------|-------------|-------------|
| `private` | Only the creator | Only the creator |
| `household` | All household members | Only the creator |

### Sharing Flow

1. Collection owner taps "Share" on a collection
2. Enter the email or username of the person to share with
3. Recipient gets a notification (in-app, email later)
4. Recipient can view the collection and copy individual recipes into their own household

### Copying Recipes

When a user copies a recipe from a shared collection:
- A full copy is created in their household's recipe box
- The copy is independent — changes to the original don't affect the copy
- `contributed_by` is set to the user who copied it
- `source_url` could optionally reference the original (nice-to-have)

### Export from Collections

Collections provide a natural surface for bulk export:
- "Export Collection" downloads all recipes in the collection as a ZIP of JSON files
- Individual recipe export is also available from recipe detail (meatball menu)

### Recipe Export on Household Leave

When a user leaves a household:
1. Prompt: "You contributed X recipes. Export them?"
2. If they accept: bulk export as JSON
3. If they're joining a new household: option to import the exported recipes
4. Their collections survive (they own them) but recipe references become tombstones:
   - Collection shows recipe title but marked as "no longer available"
   - If the user imports the recipes elsewhere, collections can be re-linked

### Adding Recipes to Collections

From the recipe detail page or browse page:
- Meatball menu → "Add to Collection" → shows list of user's collections
- Quick-add: if user only has one collection, one-tap add
- Can also add from within the collection detail page via search

## Validation

How do we know this phase is complete?

- [ ] User can create, edit, and delete collections
- [ ] User can add/remove recipes to/from collections
- [ ] Private collections are only visible to the creator
- [ ] Household collections are visible to all household members
- [ ] Only the collection owner can edit a collection
- [ ] User can share a collection with another user (by email/username)
- [ ] Shared recipient can view the collection and copy recipes to their household
- [ ] Copied recipes are independent from the original
- [ ] Bulk export from a collection works (ZIP of JSON)
- [ ] Single recipe export works from recipe detail
- [ ] Add-to-collection is accessible from recipe detail and browse pages
