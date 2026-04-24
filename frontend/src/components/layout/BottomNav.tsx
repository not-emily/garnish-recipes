import { useRef } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Search,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const navItems = [
  { to: "/recipes", icon: BookOpen, label: "Recipes", matchAlso: ["/collections"] },
  { to: "/meal-plan", icon: CalendarDays, label: "Meal Plan" },
  { to: "/grocery-list", icon: ShoppingCart, label: "Grocery" },
] as const;

type NavItem = (typeof navItems)[number];

function getActiveItem(pathname: string): NavItem | null {
  for (const item of navItems) {
    if (pathname.startsWith(item.to)) return item;
    if ("matchAlso" in item && item.matchAlso?.some((p) => pathname.startsWith(p))) {
      return item;
    }
  }
  return null;
}

export function BottomNav() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const isSearchMode = pathname === "/search";
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Remember which tab the user came from when entering search. We use a
  // ref because setSearchParams(replace:true) wipes location.state, so the
  // `from` value only survives the initial navigation.
  const sourceRef = useRef<NavItem>(navItems[0]);
  const fromPath = (state as { from?: string } | null)?.from;
  if (fromPath) {
    const fromItem = getActiveItem(fromPath);
    if (fromItem) sourceRef.current = fromItem;
  } else if (!isSearchMode) {
    const current = getActiveItem(pathname);
    if (current) sourceRef.current = current;
  }
  const activeItem = isSearchMode ? sourceRef.current : getActiveItem(pathname);

  // On desktop, never collapse — show full pill + search bar.
  // On mobile, collapse to back button + search bar.
  const shouldCollapse = isSearchMode && !isDesktop;

  return (
    <LayoutGroup>
      <nav
        aria-label="Main navigation"
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
      >
        <div className="pointer-events-none mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          {shouldCollapse && activeItem ? (
            <CollapsedNav
              backIcon={activeItem.icon}
              backLabel={activeItem.label}
              onBack={() => navigate(-1)}
            />
          ) : (
            <FullNav
              activeItem={activeItem}
              pathname={pathname}
              showSearchBar={isSearchMode}
            />
          )}
        </div>
      </nav>
    </LayoutGroup>
  );
}

// --- Full mode: pill with all tabs + search icon (or search bar on desktop) ---

function FullNav({
  activeItem,
  pathname,
  showSearchBar = false,
}: {
  activeItem: NavItem | null;
  pathname: string;
  showSearchBar?: boolean;
}) {
  return (
    <>
      <motion.div
        layoutId="nav-pill"
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-gray-100/90 p-1 shadow-sm backdrop-blur-sm"
        transition={springTransition}
      >
        {navItems.map((item) => {
          const isActive = item === activeItem;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className="relative flex h-11 w-11 items-center justify-center rounded-full"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active-bg"
                  className="absolute inset-0 rounded-full bg-white shadow-sm"
                  transition={springTransition}
                />
              )}
              <Icon
                className={`relative z-10 h-5 w-5 transition-colors ${
                  isActive ? "text-garnish-600" : "text-gray-400"
                }`}
              />
            </Link>
          );
        })}
      </motion.div>

      {showSearchBar ? (
        <SearchBar />
      ) : (
        <Link
          to="/search"
          state={{ from: pathname }}
          aria-label="Search"
          className="pointer-events-auto"
        >
          <motion.div
            layoutId="nav-search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100/90 shadow-sm backdrop-blur-sm"
            transition={springTransition}
          >
            <Search className="h-5 w-5 text-gray-500" />
          </motion.div>
        </Link>
      )}
    </>
  );
}

// --- Collapsed mode (mobile only): back icon + search bar ---

function CollapsedNav({
  backIcon: BackIcon,
  backLabel,
  onBack,
}: {
  backIcon: LucideIcon;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <>
      <motion.button
        type="button"
        onClick={onBack}
        aria-label={`Back to ${backLabel}`}
        layoutId="nav-pill"
        className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100/90 shadow-sm backdrop-blur-sm"
        transition={springTransition}
      >
        <BackIcon className="h-5 w-5 text-garnish-600" />
      </motion.button>

      <SearchBar />
    </>
  );
}

// --- Shared search bar used by both collapsed and desktop-expanded modes ---

function SearchBar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(value: string) {
    setSearchParams(value ? { q: value } : {}, { replace: true });
  }

  return (
    <motion.div
      layoutId="nav-search"
      className="pointer-events-auto relative flex min-w-0 flex-1 items-center rounded-full bg-gray-100/90 shadow-sm backdrop-blur-sm md:max-w-sm"
      transition={springTransition}
    >
      <form role="search" className="flex flex-1 items-center" onSubmit={(e) => e.preventDefault()}>
        <Search className="ml-3 h-4 w-4 shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search recipes..."
          autoFocus
          className="flex-1 bg-transparent py-2.5 pl-2 pr-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          aria-label="Search recipes"
        />
        <AnimatePresence>
          {query && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.1 }}
              onClick={() => {
                handleChange("");
                inputRef.current?.focus();
              }}
              className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-white"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </motion.button>
          )}
        </AnimatePresence>
      </form>
    </motion.div>
  );
}

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
};
