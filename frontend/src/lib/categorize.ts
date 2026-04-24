import type { GroceryCategory } from "@/types/grocery";

const CATEGORY_KEYWORDS: [GroceryCategory, string[]][] = [
  // Multi-word compounds first (checked before single words)
  ["canned_jarred", [
    "chicken broth", "beef broth", "vegetable broth",
    "chicken stock", "beef stock", "vegetable stock",
    "diced tomatoes", "crushed tomatoes", "tomato paste",
    "tomato sauce", "black beans", "kidney beans",
    "coconut milk",
  ]],
  ["spices", [
    "chili powder", "curry powder", "garlic powder", "onion powder",
    "ginger powder", "italian seasoning", "taco seasoning", "garam masala",
    "red pepper flake", "bay leaf",
  ]],
  ["oils_vinegars", [
    "olive oil", "vegetable oil", "canola oil", "coconut oil", "sesame oil",
    "apple cider vinegar", "red wine vinegar", "cooking spray",
  ]],
  ["condiments_sauces", [
    "soy sauce", "hot sauce", "bbq sauce", "fish sauce", "oyster sauce",
  ]],
  ["baking", [
    "baking soda", "baking powder", "chocolate chip", "brown sugar",
    "powdered sugar", "maple syrup",
  ]],
  ["pasta_grains", [
    "sweet potato",
  ]],
];

const SINGLE_KEYWORDS: [GroceryCategory, string[]][] = [
  ["produce", [
    "onion", "garlic", "tomato", "lettuce", "carrot", "celery", "pepper",
    "potato", "broccoli", "cauliflower", "spinach", "kale",
    "zucchini", "squash", "mushroom", "cucumber", "avocado", "corn",
    "asparagus", "eggplant", "cabbage", "radish", "beet", "turnip", "leek",
    "scallion", "shallot", "ginger", "lime", "lemon", "orange", "apple", "banana",
    "berry", "grape", "mango", "pineapple", "peach", "pear", "plum", "melon",
    "cilantro", "parsley", "herb",
  ]],
  ["dairy", [
    "milk", "cream", "cheese", "butter", "yogurt",
    "ricotta", "mozzarella", "parmesan", "cheddar", "feta",
    "egg", "eggs",
  ]],
  ["meat", [
    "beef", "chicken", "turkey", "pork", "lamb", "sausage", "bacon", "ham",
    "steak", "roast", "tenderloin", "thigh", "breast", "drumstick", "wing",
    "rib", "brisket",
  ]],
  ["seafood", [
    "salmon", "tuna", "shrimp", "cod", "tilapia", "halibut", "trout",
    "crab", "lobster", "scallop", "mussel", "clam", "fish",
  ]],
  ["deli", ["salami", "pepperoni", "prosciutto"]],
  ["bakery", [
    "bread", "roll", "bun", "bagel", "tortilla", "pita", "naan",
    "croissant", "baguette", "flatbread",
  ]],
  ["frozen_premade", ["frozen"]],
  ["canned_jarred", ["canned", "broth", "stock", "bouillon", "salsa", "chickpeas"]],
  ["pasta_grains", [
    "pasta", "spaghetti", "penne", "fettuccine", "linguine", "macaroni", "noodle",
    "rice", "quinoa", "couscous", "barley", "oat", "farro", "orzo",
  ]],
  ["condiments_sauces", [
    "ketchup", "mustard", "mayonnaise", "mayo", "sriracha",
    "worcestershire", "hoisin", "pesto", "marinara",
  ]],
  ["oils_vinegars", ["vinegar", "balsamic"]],
  ["spices", [
    "salt", "pepper", "cumin", "paprika", "oregano", "thyme", "basil",
    "rosemary", "cinnamon", "nutmeg", "cayenne", "turmeric", "coriander",
    "cardamom", "clove", "allspice", "seasoning",
  ]],
  ["baking", [
    "flour", "sugar", "yeast", "vanilla", "cornstarch", "cocoa", "honey",
    "molasses",
  ]],
  ["snacks", [
    "chips", "crackers", "popcorn", "nuts", "almond", "peanut", "walnut",
    "cashew", "granola", "pretzel",
  ]],
  ["cereal_breakfast", ["cereal", "oatmeal", "pancake", "waffle", "syrup"]],
  ["beverages", ["juice", "soda", "water", "coffee", "tea"]],
  ["household", [
    "paper towel", "napkin", "trash bag", "foil", "plastic wrap",
    "sponge", "dish soap", "detergent",
  ]],
  ["health_beauty", [
    "shampoo", "conditioner", "soap", "lotion", "toothpaste", "deodorant",
  ]],
];

function wordMatch(name: string, keyword: string): boolean {
  // Allow an optional plural suffix so keyword "paper towel" matches
  // "paper towels" and "potato" matches "potatoes". Without this, any plural
  // form fell through to "other" — the most common way users type grocery
  // items (apples, eggs, bananas, paper towels, etc.).
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}(?:es|s)?\\b`, "i");
  return re.test(name);
}

export function categorizeIngredient(name: string): GroceryCategory {
  const lower = name.toLowerCase().trim();
  // Pass 1: multi-word compounds
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => wordMatch(lower, kw))) return cat;
  }
  // Pass 2: single words
  for (const [cat, keywords] of SINGLE_KEYWORDS) {
    if (keywords.some((kw) => wordMatch(lower, kw))) return cat;
  }
  return "other";
}
