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

ActiveRecord::Schema[8.1].define(version: 2026_04_08_000002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "good_job_batches", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "callback_priority"
    t.text "callback_queue_name"
    t.datetime "created_at", null: false
    t.text "description"
    t.datetime "discarded_at"
    t.datetime "enqueued_at"
    t.datetime "finished_at"
    t.datetime "jobs_finished_at"
    t.text "on_discard"
    t.text "on_finish"
    t.text "on_success"
    t.jsonb "serialized_properties"
    t.datetime "updated_at", null: false
  end

  create_table "good_job_executions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "active_job_id", null: false
    t.datetime "created_at", null: false
    t.interval "duration"
    t.text "error"
    t.text "error_backtrace", array: true
    t.integer "error_event", limit: 2
    t.datetime "finished_at"
    t.text "job_class"
    t.uuid "process_id"
    t.text "queue_name"
    t.datetime "scheduled_at"
    t.jsonb "serialized_params"
    t.datetime "updated_at", null: false
    t.index ["active_job_id", "created_at"], name: "index_good_job_executions_on_active_job_id_and_created_at"
    t.index ["process_id", "created_at"], name: "index_good_job_executions_on_process_id_and_created_at"
  end

  create_table "good_job_processes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "lock_type", limit: 2
    t.jsonb "state"
    t.datetime "updated_at", null: false
  end

  create_table "good_job_settings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "key"
    t.datetime "updated_at", null: false
    t.jsonb "value"
    t.index ["key"], name: "index_good_job_settings_on_key", unique: true
  end

  create_table "good_jobs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "active_job_id"
    t.uuid "batch_callback_id"
    t.uuid "batch_id"
    t.text "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "cron_at"
    t.text "cron_key"
    t.text "error"
    t.integer "error_event", limit: 2
    t.integer "executions_count"
    t.datetime "finished_at"
    t.boolean "is_discrete"
    t.text "job_class"
    t.text "labels", array: true
    t.datetime "locked_at"
    t.uuid "locked_by_id"
    t.datetime "performed_at"
    t.integer "priority"
    t.text "queue_name"
    t.uuid "retried_good_job_id"
    t.datetime "scheduled_at"
    t.jsonb "serialized_params"
    t.datetime "updated_at", null: false
    t.index ["active_job_id", "created_at"], name: "index_good_jobs_on_active_job_id_and_created_at"
    t.index ["batch_callback_id"], name: "index_good_jobs_on_batch_callback_id", where: "(batch_callback_id IS NOT NULL)"
    t.index ["batch_id"], name: "index_good_jobs_on_batch_id", where: "(batch_id IS NOT NULL)"
    t.index ["concurrency_key", "created_at"], name: "index_good_jobs_on_concurrency_key_and_created_at"
    t.index ["concurrency_key"], name: "index_good_jobs_on_concurrency_key_when_unfinished", where: "(finished_at IS NULL)"
    t.index ["cron_key", "created_at"], name: "index_good_jobs_on_cron_key_and_created_at_cond", where: "(cron_key IS NOT NULL)"
    t.index ["cron_key", "cron_at"], name: "index_good_jobs_on_cron_key_and_cron_at_cond", unique: true, where: "(cron_key IS NOT NULL)"
    t.index ["finished_at"], name: "index_good_jobs_jobs_on_finished_at_only", where: "(finished_at IS NOT NULL)"
    t.index ["job_class"], name: "index_good_jobs_on_job_class"
    t.index ["labels"], name: "index_good_jobs_on_labels", where: "(labels IS NOT NULL)", using: :gin
    t.index ["locked_by_id"], name: "index_good_jobs_on_locked_by_id", where: "(locked_by_id IS NOT NULL)"
    t.index ["priority", "created_at"], name: "index_good_job_jobs_for_candidate_lookup", where: "(finished_at IS NULL)"
    t.index ["priority", "created_at"], name: "index_good_jobs_jobs_on_priority_created_at_when_unfinished", order: { priority: "DESC NULLS LAST" }, where: "(finished_at IS NULL)"
    t.index ["priority", "scheduled_at"], name: "index_good_jobs_on_priority_scheduled_at_unfinished_unlocked", where: "((finished_at IS NULL) AND (locked_by_id IS NULL))"
    t.index ["queue_name", "scheduled_at"], name: "index_good_jobs_on_queue_name_and_scheduled_at", where: "(finished_at IS NULL)"
    t.index ["scheduled_at"], name: "index_good_jobs_on_scheduled_at", where: "(finished_at IS NULL)"
  end

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

  create_table "meal_plan_entries", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.date "date", null: false
    t.integer "diners_override"
    t.boolean "include_in_grocery", default: true, null: false
    t.boolean "is_leftover", default: false, null: false
    t.bigint "leftover_of_id"
    t.integer "leftover_servings"
    t.bigint "meal_plan_id", null: false
    t.string "meal_slot", null: false
    t.integer "position", default: 0, null: false
    t.bigint "recipe_id"
    t.integer "servings_override"
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["leftover_of_id"], name: "index_meal_plan_entries_on_leftover_of_id"
    t.index ["meal_plan_id", "date", "meal_slot"], name: "idx_meal_plan_entries_on_slot"
    t.index ["meal_plan_id"], name: "index_meal_plan_entries_on_meal_plan_id"
    t.index ["recipe_id"], name: "index_meal_plan_entries_on_recipe_id"
  end

  create_table "meal_plans", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "household_id", null: false
    t.datetime "updated_at", null: false
    t.date "week_start", null: false
    t.index ["household_id", "week_start"], name: "index_meal_plans_on_household_id_and_week_start", unique: true
    t.index ["household_id"], name: "index_meal_plans_on_household_id"
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
    t.datetime "import_completed_at"
    t.text "import_error"
    t.string "import_source_type"
    t.integer "import_status"
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
    t.string "title"
    t.integer "total_time_minutes"
    t.datetime "updated_at", null: false
    t.index ["apikey"], name: "index_recipes_on_apikey", unique: true
    t.index ["category"], name: "index_recipes_on_category"
    t.index ["contributed_by_id"], name: "index_recipes_on_contributed_by_id"
    t.index ["cuisine"], name: "index_recipes_on_cuisine"
    t.index ["household_id"], name: "index_recipes_on_household_id"
    t.index ["import_status"], name: "index_recipes_on_import_status"
    t.index ["last_cooked_at"], name: "index_recipes_on_last_cooked_at"
    t.index ["primary_protein"], name: "index_recipes_on_primary_protein"
    t.index ["recipe_type"], name: "index_recipes_on_recipe_type"
    t.index ["tags"], name: "index_recipes_on_tags", using: :gin
  end

  create_table "users", force: :cascade do |t|
    t.string "apikey", null: false
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.text "llm_api_key"
    t.string "llm_model"
    t.string "llm_provider"
    t.string "name", null: false
    t.string "password_digest", null: false
    t.string "refresh_token_digest"
    t.datetime "updated_at", null: false
    t.index ["apikey"], name: "index_users_on_apikey", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "household_memberships", "households"
  add_foreign_key "household_memberships", "users"
  add_foreign_key "meal_plan_entries", "meal_plan_entries", column: "leftover_of_id"
  add_foreign_key "meal_plan_entries", "meal_plans"
  add_foreign_key "meal_plan_entries", "recipes"
  add_foreign_key "meal_plans", "households"
  add_foreign_key "recipes", "households"
  add_foreign_key "recipes", "users", column: "contributed_by_id"
end
