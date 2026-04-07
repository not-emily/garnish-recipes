module Api
  module V1
    class MembershipsController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      # GET /api/v1/households/current/members
      def index
        members = Current.household.household_memberships.active.includes(:user)

        render json: {
          data: members.map { |m| serialize_membership(m) }
        }
      end

      # PATCH /api/v1/households/current/members/:id
      def update
        target = Current.household.household_memberships.find(params[:id])

        if params[:role].present?
          policy = MembershipPolicy.new(Current.membership, target)
          result = policy.update_role?
          unless result[:allowed]
            return render json: {
              error: { code: "forbidden", message: authorization_message(result) }
            }, status: :forbidden
          end
          target.role = params[:role]
        end

        if params[:grocery_permission].present?
          policy = MembershipPolicy.new(Current.membership, target)
          result = policy.update_grocery_permission?
          unless result[:allowed]
            return render json: {
              error: { code: "forbidden", message: authorization_message(result) }
            }, status: :forbidden
          end
          target.grocery_permission = params[:grocery_permission]
        end

        if target.save
          render json: { data: serialize_membership(target) }
        else
          render json: {
            error: {
              code: "validation_failed",
              message: target.errors.full_messages.first,
              details: target.errors.messages
            }
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/households/current/members/:id
      def destroy
        target = Current.household.household_memberships.find(params[:id])

        policy = MembershipPolicy.new(Current.membership, target)
        result = policy.remove?
        unless result[:allowed]
          return render json: {
            error: { code: "forbidden", message: authorization_message(result) }
          }, status: :forbidden
        end

        target.destroy!
        head :no_content
      end

      private

      def serialize_membership(membership)
        {
          id: membership.id,
          user: {
            id: membership.user.apikey,
            name: membership.user.name,
            email: membership.user.email
          },
          role: membership.role,
          grocery_permission: membership.grocery_permission,
          is_me: membership.user_id == current_user.id,
          joined_at: membership.created_at
        }
      end
    end
  end
end
