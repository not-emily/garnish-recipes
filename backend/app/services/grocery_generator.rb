class GroceryGenerator
  attr_reader :household, :from_date, :to_date

  def initialize(household:, from_date:, to_date:)
    @household = household
    @from_date = from_date.to_date
    @to_date = to_date.to_date
    @mappings = household.ingredient_category_mappings
                         .pluck(:ingredient_name, :category, :store)
                         .each_with_object({}) do |(name, cat, store), h|
      h[name] = { category: cat, store: store }
    end
  end

  def generate
    raw_items = eligible_entries.flat_map { |entry| items_from_entry(entry) }
    aggregate(raw_items)
  end

  private

  def eligible_entries
    MealPlanEntry
      .joins(:meal_plan)
      .where(meal_plans: { household_id: household.id })
      .where(date: from_date..to_date)
      .where(include_in_grocery: true)
      .where(is_leftover: false)
      .includes(:recipe)
  end

  def items_from_entry(entry)
    case entry.kind
    when "full"
      ingredients_from_recipe(entry)
    when "quick_meal"
      [ quick_meal_item(entry) ]
    else
      []
    end
  end

  def ingredients_from_recipe(entry)
    recipe = entry.recipe
    scale = servings_scale(entry, recipe)

    recipe.all_ingredients.map do |ing|
      normalized = normalize(ing["name"])
      qty = ing["quantity"].present? ? ing["quantity"].to_f * scale : nil
      mapping = @mappings[normalized]

      {
        name: normalized,
        quantity: qty,
        unit: ing["unit"]&.strip&.downcase,
        category: mapping&.dig(:category) || categorize(normalized),
        store: mapping&.dig(:store),
        source_type: "recipe",
        source_entries: [ { entry_id: entry.id, title: recipe.title } ]
      }
    end
  end

  def quick_meal_item(entry)
    normalized = normalize(entry.display_title)
    mapping = @mappings[normalized]

    {
      name: normalized,
      quantity: 1,
      unit: nil,
      category: mapping&.dig(:category) || "frozen_premade",
      store: mapping&.dig(:store),
      source_type: "quick_meal",
      source_entries: [ { entry_id: entry.id, title: entry.display_title } ]
    }
  end

  def servings_scale(entry, recipe)
    return 1.0 unless recipe.servings&.positive?
    effective = entry.servings_override || recipe.servings
    effective.to_f / recipe.servings
  end

  # Group by (normalized name, unit), sum quantities, merge sources.
  def aggregate(items)
    groups = {}
    items.each do |item|
      key = [ item[:name], item[:unit] ]
      if groups[key]
        existing = groups[key]
        existing[:quantity] = sum_quantities(existing[:quantity], item[:quantity])
        existing[:source_entries].concat(item[:source_entries])
        existing[:source_entries].uniq! { |s| s[:entry_id] }
      else
        groups[key] = item.dup
      end
    end
    groups.values
  end

  def sum_quantities(a, b)
    return nil if a.nil? && b.nil?
    (a || 0) + (b || 0)
  end

  def normalize(name)
    name.to_s.strip.downcase.gsub(/\s+/, " ")
  end

  # Keyword-based heuristic for ingredient categorization. Checked only when
  # no household mapping exists. Checks compound (multi-word) keywords first
  # so "chicken broth" matches canned_jarred before "chicken" matches meat.
  # Uses word-boundary matching so "chopped" doesn't match "chop".
  def categorize(name)
    # Pass 1: multi-word keywords (more specific, higher priority)
    CATEGORY_KEYWORDS.each do |category, keywords|
      return category if keywords.any? { |kw| kw.include?(" ") && word_match?(name, kw) }
    end
    # Pass 2: single-word keywords
    CATEGORY_KEYWORDS.each do |category, keywords|
      return category if keywords.any? { |kw| !kw.include?(" ") && word_match?(name, kw) }
    end
    "other"
  end

  def word_match?(name, keyword)
    /\b#{Regexp.escape(keyword)}\b/i.match?(name)
  end

  CATEGORY_KEYWORDS = {
    "produce" => %w[
      onion garlic tomato lettuce carrot celery pepper bell\ pepper
      potato sweet\ potato broccoli cauliflower spinach kale
      zucchini squash mushroom cucumber avocado corn green\ bean
      asparagus eggplant cabbage radish beet turnip leek
      scallion shallot ginger lime lemon orange apple banana
      berry blueberr strawberr raspberr grape mango pineapple
      peach pear plum melon watermelon cilantro parsley basil\ fresh
      mint\ fresh dill\ fresh rosemary\ fresh thyme\ fresh jalapeño
      chili\ pepper serrano habanero poblano herb
    ],
    "dairy" => %w[
      milk cream cheese butter yogurt sour\ cream
      cream\ cheese cottage\ cheese ricotta mozzarella parmesan
      cheddar swiss feta gouda brie half-and-half whipping\ cream
      egg eggs
    ],
    "meat" => %w[
      beef chicken turkey pork lamb sausage bacon ham
      ground\ beef ground\ turkey steak roast tenderloin
      thigh breast drumstick wing rib brisket
    ],
    "seafood" => %w[
      salmon tuna shrimp cod tilapia halibut trout bass
      crab lobster scallop mussel clam oyster anchov
      fish fillet
    ],
    "deli" => %w[
      deli\ meat sliced\ turkey sliced\ ham salami pepperoni
      prosciutto
    ],
    "bakery" => %w[
      bread roll bun bagel tortilla pita naan croissant
      english\ muffin baguette flatbread
    ],
    "frozen_premade" => %w[
      frozen ice\ cream
    ],
    "canned_jarred" => %w[
      chicken\ broth beef\ broth vegetable\ broth chicken\ stock
      beef\ stock vegetable\ stock
      canned can\ of diced\ tomatoes crushed\ tomatoes tomato\ paste
      tomato\ sauce salsa beans\ canned chickpeas black\ beans
      kidney\ beans broth stock bouillon coconut\ milk
    ],
    "pasta_grains" => %w[
      pasta spaghetti penne fettuccine linguine macaroni noodle
      rice quinoa couscous barley oat farro bulgur
      orzo tortellini ravioli
    ],
    "condiments_sauces" => %w[
      ketchup mustard mayonnaise mayo soy\ sauce worcestershire
      hot\ sauce sriracha bbq\ sauce teriyaki hoisin
      fish\ sauce oyster\ sauce pesto marinara
    ],
    "oils_vinegars" => %w[
      olive\ oil vegetable\ oil canola\ oil coconut\ oil sesame\ oil
      vinegar balsamic red\ wine\ vinegar apple\ cider\ vinegar
      cooking\ spray
    ],
    "spices" => %w[
      chili\ powder curry\ powder garlic\ powder onion\ powder
      ginger\ powder italian\ seasoning taco\ seasoning garam\ masala
      red\ pepper\ flake bay\ leaf
      salt pepper cumin paprika oregano thyme basil rosemary
      cinnamon nutmeg cayenne turmeric coriander cardamom
      clove allspice seasoning
    ],
    "baking" => %w[
      flour sugar brown\ sugar powdered\ sugar baking\ soda
      baking\ powder yeast vanilla cornstarch cocoa chocolate\ chip
      honey maple\ syrup molasses
    ],
    "snacks" => %w[
      chips crackers popcorn nuts almond peanut walnut cashew
      pistachio granola trail\ mix pretzel
    ],
    "cereal_breakfast" => %w[
      cereal oatmeal pancake waffle syrup
    ],
    "beverages" => %w[
      juice soda water coffee tea kombucha wine beer
    ],
    "pantry" => %w[
      dried lentil split\ pea breadcrumb crouton
    ],
    "household" => %w[
      paper\ towel napkin trash\ bag foil plastic\ wrap
      sponge dish\ soap detergent
    ],
    "health_beauty" => %w[
      shampoo conditioner soap lotion toothpaste deodorant
    ]
  }.freeze
end
