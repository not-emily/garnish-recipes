class CollectionShare < ApplicationRecord
  PERMISSIONS = %w[view].freeze

  belongs_to :recipe_collection
  belongs_to :shared_with, class_name: "User"

  validates :shared_with_id, uniqueness: { scope: :recipe_collection_id, message: "already has access to this collection" }
  validates :permission, inclusion: { in: PERMISSIONS }
end
