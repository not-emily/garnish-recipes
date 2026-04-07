class AddImportStatusToRecipes < ActiveRecord::Migration[8.1]
  def change
    add_column :recipes, :import_status, :integer
    add_column :recipes, :import_source_type, :string
    add_column :recipes, :import_error, :text
    add_column :recipes, :import_completed_at, :datetime

    add_index :recipes, :import_status

    # Importing recipes start with no title; the parser fills it in.
    change_column_null :recipes, :title, true
  end
end
