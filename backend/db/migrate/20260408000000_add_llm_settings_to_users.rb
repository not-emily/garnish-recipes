class AddLlmSettingsToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :llm_provider, :string
    add_column :users, :llm_model, :string
    # Encrypted via Active Record encryption (Rails 8). Stored as text
    # because the ciphertext is longer than the plaintext key.
    add_column :users, :llm_api_key, :text
  end
end
