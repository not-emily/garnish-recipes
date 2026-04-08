require "test_helper"

module Api
  module V1
    class UserSettingsControllerTest < ActionDispatch::IntegrationTest
      def setup
        @password = "password123"
        @user = User.create!(name: "User", email: "us@test.com",
                             password: @password, password_confirmation: @password)
      end

      def teardown
        restore_sage_client
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      def stub_sage_test_response(content)
        stub_class = Class.new do
          define_method(:initialize) { |_config| }
          define_method(:complete) { |_, **_| Struct.new(:content).new(content) }
        end
        @original_sage_client = Sage.send(:remove_const, :Client)
        Sage.const_set(:Client, stub_class)
      end

      def stub_sage_test_raises(error)
        stub_class = Class.new do
          define_method(:initialize) { |_config| }
          define_method(:complete) { |*_args, **_kwargs| raise error }
        end
        @original_sage_client = Sage.send(:remove_const, :Client)
        Sage.const_set(:Client, stub_class)
      end

      def restore_sage_client
        return unless @original_sage_client
        Sage.send(:remove_const, :Client) if Sage.const_defined?(:Client)
        Sage.const_set(:Client, @original_sage_client)
        @original_sage_client = nil
      end

      # --- show ---

      test "show returns has_llm_key=false for a fresh user" do
        get "/api/v1/user/settings", headers: auth_headers(@user)
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal false, body["data"]["has_llm_key"]
        assert_nil body["data"]["llm_provider"]
        assert_nil body["data"]["llm_model"]
      end

      test "show never includes the API key in the response" do
        @user.update!(llm_provider: "anthropic", llm_model: "claude-haiku-4-5",
                      llm_api_key: "sk-ant-secret")
        get "/api/v1/user/settings", headers: auth_headers(@user)
        body = JSON.parse(response.body)
        refute body["data"].key?("llm_api_key")
        assert_equal true, body["data"]["has_llm_key"]
      end

      test "show requires authentication" do
        get "/api/v1/user/settings"
        assert_response :unauthorized
      end

      # --- update ---

      test "update saves llm credentials" do
        patch "/api/v1/user/settings",
              headers: auth_headers(@user),
              params: {
                llm_provider: "anthropic",
                llm_model: "claude-haiku-4-5",
                llm_api_key: "sk-ant-test"
              }, as: :json
        assert_response :ok
        @user.reload
        assert_equal "anthropic", @user.llm_provider
        assert_equal "claude-haiku-4-5", @user.llm_model
        assert_equal "sk-ant-test", @user.llm_api_key
      end

      test "update rejects half-set credentials" do
        patch "/api/v1/user/settings",
              headers: auth_headers(@user),
              params: { llm_provider: "anthropic", llm_api_key: "sk-x" },
              as: :json
        assert_response :unprocessable_entity
      end

      test "update rejects invalid provider" do
        patch "/api/v1/user/settings",
              headers: auth_headers(@user),
              params: {
                llm_provider: "skynet",
                llm_model: "x",
                llm_api_key: "y"
              }, as: :json
        assert_response :unprocessable_entity
      end

      test "update with all blank values clears credentials" do
        @user.update!(llm_provider: "anthropic", llm_model: "claude-haiku-4-5",
                      llm_api_key: "sk-ant-test")
        patch "/api/v1/user/settings",
              headers: auth_headers(@user),
              params: { llm_provider: "", llm_model: "", llm_api_key: "" },
              as: :json
        assert_response :ok
        @user.reload
        assert_nil @user.llm_provider
        assert_nil @user.llm_api_key
      end

      # --- test_llm ---

      test "test_llm with ad-hoc credentials returns ok=true on success" do
        stub_sage_test_response("ok")

        post "/api/v1/user/settings/test_llm",
             headers: auth_headers(@user),
             params: {
               provider: "anthropic",
               model: "claude-haiku-4-5",
               api_key: "sk-ant-test"
             }, as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal true, body["data"]["ok"]
        assert_equal "ok", body["data"]["reply"]
      end

      test "test_llm uses saved credentials when params are omitted" do
        @user.update!(llm_provider: "anthropic", llm_model: "claude-haiku-4-5",
                      llm_api_key: "sk-ant-test")
        stub_sage_test_response("ok")

        post "/api/v1/user/settings/test_llm",
             headers: auth_headers(@user),
             params: {}, as: :json
        assert_response :ok
        assert_equal true, JSON.parse(response.body)["data"]["ok"]
      end

      test "test_llm returns ok=false on auth error" do
        stub_sage_test_raises(Sage::AuthenticationError.new("Invalid API key"))

        post "/api/v1/user/settings/test_llm",
             headers: auth_headers(@user),
             params: {
               provider: "anthropic",
               model: "claude-haiku-4-5",
               api_key: "bad-key"
             }, as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal false, body["data"]["ok"]
        assert_equal "authentication_failed", body["data"]["error_code"]
      end

      test "test_llm rejects missing credentials" do
        post "/api/v1/user/settings/test_llm",
             headers: auth_headers(@user),
             params: {}, as: :json
        assert_response :unprocessable_entity
      end

      test "test_llm rejects invalid provider" do
        post "/api/v1/user/settings/test_llm",
             headers: auth_headers(@user),
             params: { provider: "skynet", model: "x", api_key: "y" },
             as: :json
        assert_response :unprocessable_entity
      end
    end
  end
end
