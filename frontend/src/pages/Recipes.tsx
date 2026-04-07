import { Link } from "react-router";
import { Plus } from "lucide-react";
import { RecipeBrowser } from "@/components/recipes/RecipeBrowser";
import { useHousehold } from "@/contexts/HouseholdContext";

export function Recipes() {
  const { household } = useHousehold();
  const canCreate =
    household?.my_role === "owner" || household?.my_role === "admin";

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        {canCreate && (
          <Link
            to="/recipes/new"
            className="inline-flex items-center gap-1 rounded-lg bg-garnish-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700"
          >
            <Plus className="h-4 w-4" />
            Add
          </Link>
        )}
      </div>

      <RecipeBrowser />
    </div>
  );
}
