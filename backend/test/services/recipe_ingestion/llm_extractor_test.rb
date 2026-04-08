require "test_helper"

module RecipeIngestion
  class LlmExtractorTest < ActiveSupport::TestCase
    def setup
      @user = User.create!(
        name: "Cook", email: "llm@test.com",
        password: "password123", password_confirmation: "password123",
        llm_provider: "anthropic",
        llm_model: "claude-haiku-4-5",
        llm_api_key: "sk-ant-test"
      )
    end

    def teardown
      restore_sage_client
    end

    # Replace Sage::Client with a tiny stub that captures calls and returns
    # a canned response. Avoids hitting the real Anthropic API in tests.
    def stub_sage_response(json_string, capture: nil)
      stub_class = Class.new do
        define_method(:initialize) do |_config|
          # ignore — we don't validate config in this stub
        end

        define_method(:complete) do |_profile_name, **kwargs|
          capture&.call(kwargs)
          response = Struct.new(:content).new(json_string)
          response
        end
      end
      @original_sage_client = Sage.send(:remove_const, :Client)
      Sage.const_set(:Client, stub_class)
    end

    def stub_sage_raises(error)
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

    test "raises when user has no LLM credentials" do
      @user.update_columns(llm_api_key: nil)
      assert_raises(LlmExtractor::ExtractionError) do
        LlmExtractor.call(user: @user, content: "stuff", kind: :html)
      end
    end

    test "raises when content is empty" do
      assert_raises(LlmExtractor::ExtractionError) do
        LlmExtractor.call(user: @user, content: "   ", kind: :html)
      end
    end

    test "parses a clean JSON response into a hash" do
      json = '{"title":"Pasta","ingredient_groups":[{"label":null,"ingredients":[{"name":"spaghetti"}]}],"instructions":[{"text":"Boil"}]}'
      stub_sage_response(json)

      result = LlmExtractor.call(user: @user, content: "<html>recipe</html>", kind: :html)
      assert_equal "Pasta", result["title"]
      assert_equal 1, result["ingredient_groups"].size
      assert_equal "spaghetti", result["ingredient_groups"][0]["ingredients"][0]["name"]
    end

    test "strips markdown code fences from the response" do
      stub_sage_response("```json\n{\"title\":\"X\"}\n```")
      result = LlmExtractor.call(user: @user, content: "x", kind: :html)
      assert_equal "X", result["title"]
    end

    test "raises ExtractionError on invalid JSON" do
      stub_sage_response("not json at all")
      assert_raises(LlmExtractor::ExtractionError) do
        LlmExtractor.call(user: @user, content: "x", kind: :html)
      end
    end

    test "raises ExtractionError when sage-rb raises" do
      stub_sage_raises(Sage::AuthenticationError.new("bad key"))
      err = assert_raises(LlmExtractor::ExtractionError) do
        LlmExtractor.call(user: @user, content: "x", kind: :html)
      end
      assert_match(/bad key/, err.message)
    end

    test "truncates content to MAX_CONTENT_BYTES before sending" do
      captured_prompt = nil
      stub_sage_response('{"title":"X"}', capture: ->(kwargs) { captured_prompt = kwargs[:prompt] })

      huge_content = "x" * (LlmExtractor::MAX_CONTENT_BYTES + 5_000)
      LlmExtractor.call(user: @user, content: huge_content, kind: :html)

      # The captured prompt wraps the (truncated) content; verify the body
      # never exceeds the cap plus a small wrapping overhead.
      assert captured_prompt.bytesize <= LlmExtractor::MAX_CONTENT_BYTES + 1_000,
             "prompt was #{captured_prompt.bytesize} bytes — content not truncated"
    end
  end
end
