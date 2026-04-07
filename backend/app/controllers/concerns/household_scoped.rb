module HouseholdScoped
  extend ActiveSupport::Concern

  included do
    before_action :set_current_household
  end

  private

  def set_current_household
    Current.household = current_user&.active_household
    Current.membership = current_user&.membership_for(Current.household)

    unless Current.household
      render json: {
        error: { code: "no_household", message: "You must create or join a household first" }
      }, status: :precondition_required
    end
  end
end
