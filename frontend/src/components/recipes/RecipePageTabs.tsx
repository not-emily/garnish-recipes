import { Link } from "react-router";

interface RecipePageTabsProps {
  active: "browse" | "collections";
}

export function RecipePageTabs({ active }: RecipePageTabsProps) {
  return (
    <div className="mb-4 flex rounded-lg border border-gray-200 bg-gray-50 p-1">
      <Link
        to="/recipes"
        className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors ${
          active === "browse"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Browse
      </Link>
      <Link
        to="/collections"
        className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors ${
          active === "collections"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Collections
      </Link>
    </div>
  );
}
