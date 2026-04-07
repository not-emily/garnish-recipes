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
    end
  end
end
