class AddApikeyToUsers < ActiveRecord::Migration[8.1]
  def up
    add_column :users, :apikey, :string
    add_index :users, :apikey, unique: true

    # Backfill existing users
    User.reset_column_information
    User.find_each do |user|
      apikey = nil
      loop do
        apikey = SecureRandom.urlsafe_base64
        break unless User.exists?(apikey: apikey)
      end
      user.update_column(:apikey, apikey)
    end

    change_column_null :users, :apikey, false
  end

  def down
    remove_index :users, :apikey
    remove_column :users, :apikey
  end
end
