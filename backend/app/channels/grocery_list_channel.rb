class GroceryListChannel < ApplicationCable::Channel
  def subscribed
    household = current_user.active_household
    unless household
      reject
      return
    end

    list = GroceryList.for_household!(household)
    stream_for list
  end
end
