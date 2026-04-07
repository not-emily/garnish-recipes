class HouseholdMembership < ApplicationRecord
  belongs_to :user
  belongs_to :household

  validates :role, inclusion: { in: %w[owner admin member] }
  validates :grocery_permission, inclusion: { in: %w[read contribute full] }
  validates :status, inclusion: { in: %w[invited active] }
  validates :user_id, uniqueness: { scope: :household_id }

  scope :active, -> { where(status: "active") }

  def owner?
    role == "owner"
  end

  def admin?
    role == "admin"
  end

  def member?
    role == "member"
  end

  def can_manage_members?
    owner? || admin?
  end
end
