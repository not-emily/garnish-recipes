class CreateHouseholds < ActiveRecord::Migration[8.1]
  def change
    create_table :households do |t|
      t.string :name, null: false
      t.integer :default_diners, default: 2, null: false
      t.string :leftover_suggestion, default: "ask", null: false
      t.string :leftover_default_slot, default: "lunch", null: false
      t.string :invite_code, null: false

      t.timestamps
    end

    add_index :households, :invite_code, unique: true
  end
end
