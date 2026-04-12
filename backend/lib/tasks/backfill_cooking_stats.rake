namespace :recipes do
  desc "Backfill last_cooked_at and times_cooked from existing meal plan entries"
  task backfill_cooking_stats: :environment do
    updated = 0
    Recipe.find_each do |recipe|
      recipe.recalculate_cooking_stats!
      updated += 1 if recipe.times_cooked > 0
    end
    puts "Backfilled cooking stats for #{updated} recipes (#{Recipe.count} total scanned)"
  end
end
