class Household < ApplicationRecord
  has_many :household_memberships, dependent: :destroy
  has_many :members, through: :household_memberships, source: :user
  has_many :recipes, dependent: :destroy

  validates :name, presence: true
  validates :invite_code, presence: true, uniqueness: true
  validates :default_diners, numericality: { greater_than: 0 }
  validates :leftover_suggestion, inclusion: { in: %w[on off ask] }
  validates :leftover_default_slot, inclusion: { in: %w[breakfast lunch dinner ask] }

  before_validation :generate_invite_code, on: :create

  def owner
    household_memberships.find_by(role: "owner")&.user
  end

  def regenerate_invite_code!
    update!(invite_code: self.class.generate_code)
  end

  private

  def generate_invite_code
    self.invite_code ||= self.class.generate_code
  end

  def self.generate_code
    words = %w[
      basil thyme sage mint rosemary dill cumin paprika
      olive lemon garlic ginger pepper saffron nutmeg fennel
      berry apple mango peach plum fig grape melon
      stew roast braise saute grill toast simmer blend
    ]
    loop do
      code = "#{words.sample.upcase}-#{words.sample.upcase}-#{rand(10..99)}"
      break code unless exists?(invite_code: code)
    end
  end
end
