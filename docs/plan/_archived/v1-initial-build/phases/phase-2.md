# Phase 2: Households

> **Depends on:** Phase 1 (auth, app shell)
> **Enables:** Phase 3 (recipes), Phase 5 (meal planning), Phase 7 (grocery lists)
>
> See: [Full Plan](../plan.md)

## Goal

Implement the household system so that users can create a household, invite members, join via invite code, and manage roles/permissions. This is the multi-tenancy foundation — all subsequent features are scoped to a household.

## Key Deliverables

- Household creation and settings management
- Post-signup onboarding flow (create or join a household)
- Invitation system (generate invite link/code, accept invitation)
- Household membership with roles (owner/admin/member)
- Configurable member grocery list permissions (read/contribute/full)
- Household context throughout the app (all data scoped to active household)
- Member management UI (view members, update roles, remove members)

## Files to Create

### Backend
- `backend/app/models/household.rb` — Household model
- `backend/app/models/household_membership.rb` — Membership join model with role/permissions
- `backend/app/controllers/api/v1/households_controller.rb` — CRUD, settings
- `backend/app/controllers/api/v1/memberships_controller.rb` — Invite, join, manage members
- `backend/app/policies/household_policy.rb` — Authorization for household actions
- `backend/app/policies/membership_policy.rb` — Who can invite, update roles, remove
- `backend/db/migrate/*_create_households.rb`
- `backend/db/migrate/*_create_household_memberships.rb`

### Frontend
- `frontend/src/pages/Onboarding.tsx` — Create or join household flow
- `frontend/src/components/household/HouseholdSettings.tsx` — Settings (name, default diners, leftover preferences)
- `frontend/src/components/household/MemberList.tsx` — View and manage members
- `frontend/src/components/household/InviteFlow.tsx` — Generate and share invite link
- `frontend/src/components/household/JoinFlow.tsx` — Enter invite code
- `frontend/src/contexts/HouseholdContext.tsx` — Active household state
- `frontend/src/api/households.ts` — API client for household endpoints
- `frontend/src/hooks/useHousehold.ts` — Household data hook

## Dependencies

**Internal:** Phase 1 (user auth, app shell, API client)

**External:**
- `pundit` — Authorization policies (set up in Phase 1)
- No additional gems needed

## Implementation Notes

### Data Model

```ruby
# households
create_table :households do |t|
  t.string :name, null: false
  t.integer :default_diners, default: 2
  t.string :leftover_suggestion, default: 'ask'  # on, off, ask
  t.string :leftover_default_slot, default: 'lunch'  # breakfast, lunch, dinner, ask
  t.string :invite_code, null: false, index: { unique: true }
  t.timestamps
end

# household_memberships
create_table :household_memberships do |t|
  t.references :user, null: false, foreign_key: true
  t.references :household, null: false, foreign_key: true
  t.string :role, null: false, default: 'member'  # owner, admin, member
  t.string :grocery_permission, null: false, default: 'contribute'  # read, contribute, full
  t.string :status, null: false, default: 'active'  # invited, active
  t.timestamps
  t.index [:user_id, :household_id], unique: true
end
```

### Onboarding Flow
After signup (Phase 1), the user lands on the onboarding screen:
1. **Create a Household** — enter a name, set default diners → becomes owner
2. **Join a Household** — enter invite code → becomes member with default permissions

The app should not show the main navigation or any features until the user is in a household. Redirect to onboarding if `current_user.active_household` is nil.

### Invite System
- Each household has a unique `invite_code` (short, human-readable, e.g., "GARNISH-BEEF-42")
- Owner/admin can regenerate the invite code (invalidates old one)
- Invite link: `garnish.yourdomain.com/join/GARNISH-BEEF-42`
- Anyone with the code can join (no email-specific invitations in v1)
- Owner/admin can remove members after they join

### Role Permissions

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Update household settings | Yes | No | No |
| Invite members | Yes | Yes | No |
| Remove members | Yes | Yes (not owner) | No |
| Update member roles | Yes | No | No |
| Update member grocery permissions | Yes | Yes | No |
| Delete household | Yes | No | No |

### Household Scoping
Add a concern or middleware that sets `Current.household` based on the authenticated user's active household membership. All subsequent controllers inherit this scoping:

```ruby
# app/controllers/concerns/household_scoped.rb
module HouseholdScoped
  extend ActiveSupport::Concern

  included do
    before_action :set_current_household
  end

  private

  def set_current_household
    Current.household = current_user.active_household
    head :precondition_required unless Current.household
  end
end
```

## Validation

How do we know this phase is complete?

- [ ] User sees onboarding screen after signup (create or join)
- [ ] User can create a household and becomes owner
- [ ] User can join a household via invite code
- [ ] No phantom/auto-created households — users only get a household when they explicitly create or join one
- [ ] Owner can update household settings (name, default diners, leftover preferences)
- [ ] Owner/admin can see member list and manage roles
- [ ] Owner/admin can generate/share invite code
- [ ] Owner can remove members and update grocery permissions
- [ ] All API endpoints are scoped to the user's active household
- [ ] Users without a household are redirected to onboarding
- [ ] Role-based authorization works correctly (Pundit policies)
