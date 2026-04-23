require "test_helper"

module Api
  module V1
    class HealthControllerTest < ActionDispatch::IntegrationTest
      test "GET /api/v1/health returns 200 with subsystem status when healthy" do
        get "/api/v1/health"

        assert_response :ok
        body = JSON.parse(response.body)

        assert body["ok"], "expected ok=true, got #{body.inspect}"
        assert_equal true, body.dig("database", "reachable")
        assert body.dig("database", "pool_size").is_a?(Integer)
        assert body.dig("goodjob", "mode").present?
        assert body["timestamp"].present?
      end

      test "GET /api/v1/health does not require authentication" do
        # No Authorization header — endpoint must still answer so external
        # monitors can ping it.
        get "/api/v1/health"
        assert_response :ok
      end
    end
  end
end
