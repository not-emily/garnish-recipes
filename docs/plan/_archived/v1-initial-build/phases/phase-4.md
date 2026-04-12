# Phase 4: Recipe Ingestion

> **Depends on:** Phase 3 (recipe model, CRUD)
> **Enables:** Enhanced recipe entry experience (not a blocker for other phases)
>
> See: [Full Plan](../plan.md)

## Goal

Build the recipe import pipeline that lets users add recipes from URLs, PDFs, and images. JSON-LD structured data is parsed directly (no LLM needed). LLM-powered extraction via sage-rb is available for users who configure API keys. Non-LLM users get source material stored as attachments for manual reference.

## Key Deliverables

- URL import with JSON-LD/Schema.org recipe extraction
- PDF import with text extraction
- Image import
- LLM-powered recipe extraction via sage-rb (optional, user-provided keys)
- Graceful fallback: store source material as attachment, user fills in details manually
- Background job processing with status updates
- Import UI with progress indicators
- User LLM API key management (encrypted storage)

## Files to Create

### Backend
- `backend/app/services/recipe_ingestion/base.rb` — Shared ingestion logic
- `backend/app/services/recipe_ingestion/url_parser.rb` — Fetch URL, extract content
- `backend/app/services/recipe_ingestion/json_ld_extractor.rb` — Parse Schema.org/Recipe JSON-LD
- `backend/app/services/recipe_ingestion/pdf_parser.rb` — Extract text from PDF
- `backend/app/services/recipe_ingestion/image_parser.rb` — Handle image uploads
- `backend/app/services/recipe_ingestion/llm_extractor.rb` — sage-rb integration for structured extraction
- `backend/app/services/recipe_ingestion/normalizer.rb` — Normalize extracted data to recipe schema
- `backend/app/jobs/recipe_ingestion_job.rb` — GoodJob async processing
- `backend/app/controllers/api/v1/imports_controller.rb` — Import endpoint
- `backend/app/controllers/api/v1/user_settings_controller.rb` — API key management
- `backend/app/models/concerns/encryptable.rb` — Encrypted attribute helpers
- `backend/db/migrate/*_add_encrypted_api_keys_to_users.rb`
- `backend/db/migrate/*_create_recipe_attachments.rb`

### Frontend
- `frontend/src/components/recipes/ImportModal.tsx` — Import dialog (URL/PDF/image tabs)
- `frontend/src/components/recipes/ImportProgress.tsx` — Progress indicator for processing recipes
- `frontend/src/pages/Settings.tsx` — Update to include API key configuration
- `frontend/src/components/settings/ApiKeyForm.tsx` — Encrypted API key input

## Dependencies

**Internal:** Phase 3 (recipe model, create endpoint)

**External:**
- `sage-rb` — Unified LLM adapter for recipe extraction
- `nokogiri` — HTML parsing for URL import (likely already included with Rails)
- `json-ld` or manual JSON-LD parsing — Extract structured recipe data
- `pdf-reader` — PDF text extraction
- `active_storage` — File attachments (images, PDFs)
- `aws-sdk-s3` — ActiveStorage adapter for Cloudflare R2

## Implementation Notes

### Ingestion Flow

```
User submits URL/PDF/image
  │
  ├─ Create draft Recipe (status: importing, title from filename/URL)
  ├─ Store source material as attachment (always)
  ├─ Enqueue RecipeIngestionJob
  │
  └─ RecipeIngestionJob:
       ├─ URL path:
       │   ├─ Fetch HTML
       │   ├─ Look for JSON-LD Recipe markup
       │   ├─ If found → parse to recipe fields (no LLM needed)
       │   ├─ If not found + user has LLM keys → sage-rb extraction
       │   └─ If not found + no keys → leave as draft with URL attached
       │
       ├─ PDF path:
       │   ├─ Extract text via pdf-reader
       │   ├─ If user has LLM keys → sage-rb structures the text
       │   └─ If no keys → leave as draft with PDF attached
       │
       ├─ Image path:
       │   ├─ If user has LLM keys → sage-rb vision extraction
       │   └─ If no keys → leave as draft with image attached
       │
       └─ On completion:
            ├─ Update recipe with extracted data
            ├─ Set status: complete | needs_review | failed
            └─ Notify frontend (polling or ActionCable)
```

### Recipe Import Status

Add `import_status` to recipes:
```ruby
# null = manually created, not imported
# importing = background job running
# complete = successfully parsed
# needs_review = partially parsed, user should review
# failed = ingestion error
enum :import_status, { importing: 0, complete: 1, needs_review: 2, failed: 3 }, prefix: true
```

### JSON-LD Extraction
Most recipe blogs embed Schema.org Recipe structured data. This is the gold path — reliable, free, no LLM:

```ruby
# Look for <script type="application/ld+json"> containing @type: Recipe
# Parse: name, description, recipeIngredient, recipeInstructions,
#        prepTime, cookTime, recipeYield, recipeCategory, recipeCuisine, image
```

### LLM Extraction via sage-rb
For sources without structured data, send content to an LLM with a prompt like:
```
Extract a structured recipe from the following content.
Return JSON with: title, description, servings, prep_time_minutes,
cook_time_minutes, category, cuisine, ingredient_groups, instructions.
```

User's API keys are decrypted at runtime and passed to sage-rb. Keys are never logged or exposed in responses.

### API Key Storage
```ruby
# users table additions
t.text :encrypted_llm_provider  # e.g., "anthropic", "openai"
t.text :encrypted_llm_api_key
```

Use Rails 8 encrypted attributes (`encrypts :llm_api_key`). Keys are encrypted at rest with the application's master key.

### Attachment Storage
Use ActiveStorage with Cloudflare R2 as the backend:
- Recipe images (uploaded or extracted from source)
- Source PDFs
- Source images (photos of recipe cards/books)

R2 is S3-compatible, so `aws-sdk-s3` works directly. Free egress.

## Validation

How do we know this phase is complete?

- [ ] User can import a recipe via URL — JSON-LD recipes parse automatically without LLM
- [ ] User can import a recipe via PDF upload
- [ ] User can import a recipe via image upload
- [ ] With LLM keys configured: PDF and image sources are auto-extracted to structured recipes
- [ ] Without LLM keys: source material is stored as attachment, recipe created as draft for manual entry
- [ ] Import progress is visible in the UI (importing → complete/needs_review/failed)
- [ ] User can configure encrypted LLM API keys in settings
- [ ] Background jobs process imports without blocking the UI
- [ ] Source attachments are stored in Cloudflare R2 via ActiveStorage
- [ ] Imported recipes can be edited/corrected after import
