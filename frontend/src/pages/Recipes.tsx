import { useState } from "react";
import { Link } from "react-router";
import { Plus, Download } from "lucide-react";
import { RecipeBrowser } from "@/components/recipes/RecipeBrowser";
import { ImportModal } from "@/components/recipes/ImportModal";
import { RecipePageTabs } from "@/components/recipes/RecipePageTabs";
import { useHousehold } from "@/contexts/HouseholdContext";

export function Recipes() {
  const { household } = useHousehold();
  const canCreate =
    household?.my_role === "owner" || household?.my_role === "admin";
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        {canCreate && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Import
            </button>
            <Link
              to="/recipes/new"
              className="inline-flex items-center gap-1 rounded-lg bg-garnish-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700"
            >
              <Plus className="h-4 w-4" />
              Add
            </Link>
          </div>
        )}
      </div>

      <RecipePageTabs active="browse" />

      <RecipeBrowser />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

export default Recipes;
