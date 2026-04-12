class CreateCollectionShares < ActiveRecord::Migration[8.0]
  def change
    create_table :collection_shares do |t|
      t.references :recipe_collection, null: false, foreign_key: true
      t.references :shared_with, null: false, foreign_key: { to_table: :users }
      t.string :permission, null: false, default: "view"
      t.timestamps
    end

    add_index :collection_shares, [:recipe_collection_id, :shared_with_id],
              unique: true, name: "idx_collection_shares_unique"
  end
end
