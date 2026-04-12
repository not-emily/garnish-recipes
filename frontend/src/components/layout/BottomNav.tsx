import { NavLink, useLocation } from "react-router";
import {
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Settings,
} from "lucide-react";

const navItems = [
  { to: "/recipes", icon: BookOpen, label: "Recipes", matchAlso: ["/collections"] },
  { to: "/meal-plan", icon: CalendarDays, label: "Meal Plan" },
  { to: "/grocery-list", icon: ShoppingCart, label: "Grocery" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {navItems.map(({ to, icon: Icon, label, ...rest }) => {
          const matchAlso = "matchAlso" in rest ? rest.matchAlso : undefined;
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => {
                const extraMatch = matchAlso?.some((p) => pathname.startsWith(p)) ?? false;
                const active = isActive || extraMatch;
                return `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                  active
                    ? "text-garnish-600"
                    : "text-gray-400 hover:text-gray-600"
                }`;
              }}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
