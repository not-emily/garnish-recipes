module Api
  module V1
    class HouseholdsController < ApplicationController
      before_action :authenticate!

      # POST /api/v1/households — create a new household (onboarding)
      def create
        if current_user.active_household
          return render json: {
            error: { code: "already_in_household", message: "You are already in a household" }
          }, status: :unprocessable_entity
        end

        household = Household.new(create_params)

        if household.save
          household.household_memberships.create!(
            user: current_user,
            role: "owner",
            grocery_permission: "full",
            status: "active"
          )

          render json: { data: serialize_household(household) }, status: :created
        else
          render json: {
            error: {
              code: "validation_failed",
              message: household.errors.full_messages.first,
              details: household.errors.messages
            }
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/households/join — join via invite code (onboarding)
      def join
        if current_user.active_household
          return render json: {
            error: { code: "already_in_household", message: "You are already in a household" }
          }, status: :unprocessable_entity
        end

        household = Household.find_by(invite_code: params[:invite_code])

        unless household
          return render json: {
            error: { code: "invalid_invite_code", message: "Invalid invite code" }
          }, status: :not_found
        end

        membership = household.household_memberships.create!(
          user: current_user,
          role: "member",
          grocery_permission: "contribute",
          status: "active"
        )

        render json: { data: serialize_household(household) }, status: :created
      rescue ActiveRecord::RecordNotUnique
        render json: {
          error: { code: "already_member", message: "You are already a member of this household" }
        }, status: :unprocessable_entity
      end

      # GET /api/v1/households/current — get active household
      def show
        household = current_user.active_household

        unless household
          return render json: {
            error: { code: "no_household", message: "You are not in a household" }
          }, status: :not_found
        end

        render json: { data: serialize_household(household) }
      end

      # PATCH /api/v1/households/current — update household settings
      def update
        household = current_user.active_household
        membership = current_user.membership_for(household)

        policy = HouseholdPolicy.new(membership)
        result = policy.update?
        unless result[:allowed]
          return render json: {
            error: { code: "forbidden", message: authorization_message(result) }
          }, status: :forbidden
        end

        if household.update(update_params)
          render json: { data: serialize_household(household) }
        else
          render json: {
            error: {
              code: "validation_failed",
              message: household.errors.full_messages.first,
              details: household.errors.messages
            }
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/households/current/regenerate_invite
      def regenerate_invite
        household = current_user.active_household
        membership = current_user.membership_for(household)

        policy = HouseholdPolicy.new(membership)
        result = policy.regenerate_invite_code?
        unless result[:allowed]
          return render json: {
            error: { code: "forbidden", message: authorization_message(result) }
          }, status: :forbidden
        end

        household.regenerate_invite_code!
        render json: { data: { invite_code: household.invite_code } }
      end

      private

      def create_params
        params.require(:household).permit(:name, :default_diners)
      end

      def update_params
        params.require(:household).permit(:name, :default_diners, :leftover_suggestion, :leftover_default_slot)
      end

      def serialize_household(household)
        membership = current_user.membership_for(household)
        {
          id: household.id,
          name: household.name,
          default_diners: household.default_diners,
          leftover_suggestion: household.leftover_suggestion,
          leftover_default_slot: household.leftover_default_slot,
          invite_code: membership&.can_manage_members? ? household.invite_code : nil,
          my_role: membership&.role,
          my_grocery_permission: membership&.grocery_permission,
          member_count: household.household_memberships.active.count,
          created_at: household.created_at
        }
      end
    end
  end
end
