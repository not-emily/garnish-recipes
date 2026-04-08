# Wire Active Record encryption keys from Figaro / environment variables.
# Garnish uses Figaro instead of Rails encrypted credentials, so the standard
# `bin/rails db:encryption:init` flow doesn't apply — we read from ENV here.
#
# Losing any of these keys is equivalent to losing the encrypted column data,
# so production keys must be backed up separately and never committed to git.

Rails.application.config.active_record.encryption.tap do |enc|
  enc.primary_key = ENV.fetch("AR_ENCRYPTION_PRIMARY_KEY")
  enc.deterministic_key = ENV.fetch("AR_ENCRYPTION_DETERMINISTIC_KEY")
  enc.key_derivation_salt = ENV.fetch("AR_ENCRYPTION_KEY_DERIVATION_SALT")

  # Don't expose plaintext via the dirty-tracking helpers (`field_was`,
  # `previous_changes`) — only the encrypted ciphertext.
  enc.support_unencrypted_data = false
end
