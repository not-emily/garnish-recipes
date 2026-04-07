# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_04_07_032458) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "household_memberships", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "grocery_permission", default: "contribute", null: false
    t.bigint "household_id", null: false
    t.string "role", default: "member", null: false
    t.string "status", default: "active", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["household_id"], name: "index_household_memberships_on_household_id"
    t.index ["user_id", "household_id"], name: "index_household_memberships_on_user_id_and_household_id", unique: true
    t.index ["user_id"], name: "index_household_memberships_on_user_id"
  end

  create_table "households", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "default_diners", default: 2, null: false
    t.string "invite_code", null: false
    t.string "leftover_default_slot", default: "lunch", null: false
    t.string "leftover_suggestion", default: "ask", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["invite_code"], name: "index_households_on_invite_code", unique: true
  end

  create_table "recipes", force: :cascade do |t|
    t.string "apikey", null: false
    t.string "category"
    t.bigint "contributed_by_id", null: false
    t.integer "cook_time_minutes"
    t.datetime "created_at", null: false
    t.string "cuisine"
    t.text "description"
    t.string "difficulty"
    t.bigint "household_id", null: false
    t.string "image_url"
    t.jsonb "ingredient_groups", default: [], null: false
    t.jsonb "instructions", default: [], null: false
    t.date "last_cooked_at"
    t.text "notes"
    t.integer "prep_time_minutes"
    t.string "primary_protein"
    t.string "recipe_type", default: "full", null: false
    t.integer "servings"
    t.string "source_url"
    t.string "tags", default: [], null: false, array: true
    t.integer "times_cooked", default: 0, null: false
    t.string "title", null: false
    t.integer "total_time_minutes"
    t.datetime "updated_at", null: false
    t.index ["apikey"], name: "index_recipes_on_apikey", unique: true
    t.index ["category"], name: "index_recipes_on_category"
    t.index ["contributed_by_id"], name: "index_recipes_on_contributed_by_id"
    t.index ["cuisine"], name: "index_recipes_on_cuisine"
    t.index ["household_id"], name: "index_recipes_on_household_id"
    t.index ["last_cooked_at"], name: "index_recipes_on_last_cooked_at"
    t.index ["primary_protein"], name: "index_recipes_on_primary_protein"
    t.index ["recipe_type"], name: "index_recipes_on_recipe_type"
    t.index ["tags"], name: "index_recipes_on_tags", using: :gin
  end

  create_table "users", force: :cascade do |t|
    t.string "apikey", null: false
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "name", null: false
    t.string "password_digest", null: false
    t.string "refresh_token_digest"
    t.datetime "updated_at", null: false
    t.index ["apikey"], name: "index_users_on_apikey", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "household_memberships", "households"
  add_foreign_key "household_memberships", "users"
  add_foreign_key "recipes", "households"
  add_foreign_key "recipes", "users", column: "contributed_by_id"
end
