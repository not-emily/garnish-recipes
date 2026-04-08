module Api
  module V1
    # Per-user settings controller. Currently scoped to LLM credentials,
    # but the same controller can grow to hold notification preferences,
    # display options, etc. as the app expands.
    #
    # The actual API key is never returned in any response — only the
    # boolean `has_llm_key` flag, plus the non-secret provider/model fields.
    class UserSettingsController < ApplicationController
      before_action :authenticate!

      # GET /api/v1/user/settings
      def show
        render json: { data: serialize_settings }
      end

      # PATCH /api/v1/user/settings
      #
      # Body: { llm_provider:, llm_model:, llm_api_key: }
      # Pass an empty string for llm_api_key to clear it. Provider and model
      # are also clearable. Validation enforces that all three are set or
      # all three are empty.
      def update
        attrs = settings_params
        # Treat blank strings as nil so the user can clear fields by
        # submitting an empty value (e.g., to remove their LLM key).
        attrs.transform_values! { |v| v.blank? ? nil : v }

        if current_user.update(attrs)
          render json: { data: serialize_settings }
        else
          render json: {
            error: {
              code: "validation_failed",
              message: current_user.errors.full_messages.first,
              details: current_user.errors.messages
            }
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/user/settings/test_llm
      #
      # Fires a tiny prompt at the configured (or supplied) LLM and reports
      # success/failure plus the model's actual response. Lets the user
      # verify their key works before saving — passes are cheap (~5 input
      # tokens, ~5 output tokens, fractions of a cent).
      #
      # Accepts optional body params to test unsaved credentials:
      #   { provider:, api_key:, model: }
      # If omitted, falls back to the user's saved settings.
      def test_llm
        provider = params[:provider].presence || current_user.llm_provider
        api_key  = params[:api_key].presence  || current_user.llm_api_key
        model    = params[:model].presence    || current_user.llm_model

        if provider.blank? || api_key.blank? || model.blank?
          return render json: {
            error: { code: "missing_credentials",
                     message: "Provider, API key, and model are all required" }
          }, status: :unprocessable_entity
        end

        unless User::LLM_PROVIDERS.include?(provider)
          return render json: {
            error: { code: "invalid_provider",
                     message: "Provider must be one of: #{User::LLM_PROVIDERS.join(", ")}" }
          }, status: :unprocessable_entity
        end

        result = run_test_prompt(provider: provider, api_key: api_key, model: model)
        render json: { data: result }
      end

      private

      def settings_params
        params.permit(:llm_provider, :llm_model, :llm_api_key)
      end

      def serialize_settings
        {
          llm_provider: current_user.llm_provider,
          llm_model: current_user.llm_model,
          # Never echo the actual key. Only confirm presence.
          has_llm_key: current_user.llm_api_key.present?
        }
      end

      # Build a one-shot Sage::Client with the given credentials and ask the
      # model to reply with a single word. Captures any error so the user
      # gets actionable feedback rather than a 500.
      def run_test_prompt(provider:, api_key:, model:)
        require "sage"

        config = Sage::Configuration.new
        config.provider(provider.to_sym, api_key: api_key)
        config.profile(:test, provider: provider.to_sym, model: model)
        client = Sage::Client.new(config)

        response = client.complete(
          :test,
          prompt: 'Reply with exactly one word: "ok". No punctuation, no formatting.',
          max_tokens: 10
        )

        {
          ok: true,
          provider: provider,
          model: model,
          reply: response.content.to_s.strip
        }
      rescue Sage::AuthenticationError => e
        { ok: false, error_code: "authentication_failed", message: e.message }
      rescue Sage::ConnectionError => e
        { ok: false, error_code: "connection_failed", message: e.message }
      rescue Sage::ProviderError => e
        { ok: false, error_code: "provider_error", message: e.message }
      rescue Sage::Error, StandardError => e
        { ok: false, error_code: "unknown", message: "#{e.class}: #{e.message}" }
      end
    end
  end
end
