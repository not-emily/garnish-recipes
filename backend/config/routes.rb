Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Auth
      post "auth/signup", to: "auth#signup"
      post "auth/login", to: "auth#login"
      post "auth/refresh", to: "auth#refresh"
      delete "auth/logout", to: "auth#logout"
      get "auth/me", to: "auth#me"

      # Households
      post "households", to: "households#create"
      post "households/join", to: "households#join"
      get "households/current", to: "households#show"
      patch "households/current", to: "households#update"
      post "households/current/regenerate_invite", to: "households#regenerate_invite"

      # Members
      get "households/current/members", to: "memberships#index"
      patch "households/current/members/:id", to: "memberships#update"
      delete "households/current/members/:id", to: "memberships#destroy"

      # Recipes
      get "recipes", to: "recipes#index"
      post "recipes", to: "recipes#create"
      get "recipes/:apikey", to: "recipes#show"
      patch "recipes/:apikey", to: "recipes#update"
      delete "recipes/:apikey", to: "recipes#destroy"

      # Recipe imports
      post "imports", to: "imports#create"
      get "imports/:apikey", to: "imports#show"

      # User settings (LLM credentials, etc)
      get "user/settings", to: "user_settings#show"
      patch "user/settings", to: "user_settings#update"
      post "user/settings/test_llm", to: "user_settings#test_llm"

      # Meal plans — one plan per (household, week_start). The :week_start
      # param is any date within the target week; the controller canonicalises
      # it to the Monday.
      get    "meal_plans/:week_start",                  to: "meal_plans#show"
      post   "meal_plans/:week_start/entries",          to: "meal_plans#create_entry"
      patch  "meal_plans/:week_start/entries/:id",      to: "meal_plans#update_entry"
      delete "meal_plans/:week_start/entries/:id",      to: "meal_plans#destroy_entry"
      post   "meal_plans/:week_start/entries/reorder",  to: "meal_plans#reorder_entries"
    end
  end
end
