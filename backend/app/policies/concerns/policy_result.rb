module PolicyResult
  def allow
    { allowed: true }
  end

  def deny(reason)
    { allowed: false, reason: reason }
  end
end
