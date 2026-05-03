require "test_helper"
require "tempfile"

class ImageUrlFetcherTest < ActiveSupport::TestCase
  def make_tempfile_with_content_type(bytes, content_type)
    tf = Tempfile.new("img")
    tf.binmode
    tf.write(bytes)
    tf.rewind
    # Down sets `content_type` on the returned Tempfile via its own wrapper —
    # stub the method on the singleton so the fetcher's check sees what we
    # want without depending on Down internals.
    tf.define_singleton_method(:content_type) { content_type }
    tf
  end

  # Replace Down.download with a callable for the duration of the test, then
  # restore. Used instead of Minitest's `stub` because `Object#stub` doesn't
  # reliably reach module-level methods in our setup.
  def with_down_download(replacement)
    original = Down.singleton_class.instance_method(:download)
    Down.define_singleton_method(:download, replacement)
    yield
  ensure
    Down.singleton_class.send(:define_method, :download, original)
  end

  test "returns error when URL is blank" do
    result = ImageUrlFetcher.fetch("")
    assert_equal "URL is required", result.error
    assert_nil result.tempfile
  end

  test "returns error when URL is malformed" do
    result = ImageUrlFetcher.fetch("http://[bad")
    assert_equal "URL is invalid", result.error
  end

  test "returns error for non-http scheme (SSRF guard)" do
    result = ImageUrlFetcher.fetch("file:///etc/passwd")
    assert_equal "URL must be http or https", result.error
  end

  test "returns error for ftp scheme" do
    result = ImageUrlFetcher.fetch("ftp://example.com/img.jpg")
    assert_equal "URL must be http or https", result.error
  end

  test "happy path: jpeg returns Result with tempfile/filename/content_type" do
    tf = make_tempfile_with_content_type("\xFF\xD8\xFF".b, "image/jpeg")
    with_down_download(->(*_args, **_kwargs) { tf }) do
      result = ImageUrlFetcher.fetch("https://example.com/cookies.jpg")
      assert_nil result.error
      assert_equal tf, result.tempfile
      assert_equal "cookies.jpg", result.filename
      assert_equal "image/jpeg", result.content_type
    end
  ensure
    tf&.close!
  end

  test "happy path: png with no extension in URL gets one inferred from content type" do
    tf = make_tempfile_with_content_type("\x89PNG".b, "image/png")
    with_down_download(->(*_args, **_kwargs) { tf }) do
      result = ImageUrlFetcher.fetch("https://example.com/path/no-extension")
      assert_nil result.error
      assert_equal "no-extension.png", result.filename
    end
  ensure
    tf&.close!
  end

  # Messages are predicates without an "Image" prefix — the controller's
  # `errors.add(:image, msg)` plus Rails' full_messages adds it.
  test "rejects oversize image" do
    with_down_download(->(*_args, **_kwargs) { raise Down::TooLarge.new("too big") }) do
      result = ImageUrlFetcher.fetch("https://example.com/huge.jpg")
      assert_equal "must be under 10 MB", result.error
    end
  end

  test "rejects on timeout" do
    with_down_download(->(*_args, **_kwargs) { raise Down::TimeoutError.new("slow") }) do
      result = ImageUrlFetcher.fetch("https://example.com/slow.jpg")
      assert_equal "URL timed out", result.error
    end
  end

  test "rejects 404 with friendly message" do
    with_down_download(->(*_args, **_kwargs) { raise Down::NotFound.new("404") }) do
      result = ImageUrlFetcher.fetch("https://example.com/missing.jpg")
      assert_equal "URL was not found", result.error
    end
  end

  test "rejects non-image content type and closes the tempfile" do
    tf = make_tempfile_with_content_type("<html></html>", "text/html")
    closed = false
    tf.define_singleton_method(:close!) { closed = true }
    with_down_download(->(*_args, **_kwargs) { tf }) do
      result = ImageUrlFetcher.fetch("https://example.com/recipe.html")
      assert_equal "must be JPEG, PNG, WebP, or HEIC", result.error
      assert closed, "expected tempfile to be closed when content-type rejected"
    end
  end

  test "wraps generic Down::Error with a friendly user-facing message (logs details)" do
    with_down_download(->(*_args, **_kwargs) { raise Down::Error.new("connection refused") }) do
      result = ImageUrlFetcher.fetch("https://example.com/x.jpg")
      assert_match(/check the URL and try again/, result.error)
      assert_no_match(/connection refused/, result.error, "underlying error details should not leak")
    end
  end
end
