import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { X, Search, Book, Calendar, StickyNote, Loader2, Plus } from "lucide-react";
import { listRecipes, createRecipe } from "@/api/recipes";
import type { MealSlot } from "@/types/mealPlan";
import type { RecipeSummary, RecipeCategory, RecipeType } from "@/types/recipe";
import { RECIPE_CATEGORIES } from "@/types/recipe";
import type { ApiError } from "@/types";
import { formatWeekdayLong, formatMonthDay } from "@/lib/weekUtils";

type Tab = "recipe" | "event" | "note";

interface EntryPickerProps {
  open: boolean;
  target: { date: string; slot: MealSlot } | null;
  onClose: () => void;
  onSelectRecipe: (recipeId: string) => void;
  onCreateNote: (title: string) => void;
}

export function EntryPicker({
  open,
  target,
  onClose,
  onSelectRecipe,
  onCreateNote,
}: EntryPickerProps) {
  const [tab, setTab] = useState<Tab>("recipe");

  // Reset tab to default whenever the picker is re-opened, so it doesn't
  // surprise the user with whatever they selected last time.
  useEffect(() => {
    if (open) setTab("recipe");
  }, [open]);

  // Esc-to-close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !target) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/40 transition-opacity"
      />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add to meal plan</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {formatWeekdayLong(target.date)}, {formatMonthDay(target.date)} · {target.slot}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 border-b border-gray-100 p-3">
          <TabButton active={tab === "recipe"} onClick={() => setTab("recipe")} icon={Book} label="Recipe" />
          <TabButton active={tab === "event"} onClick={() => setTab("event")} icon={Calendar} label="Event" />
          <TabButton active={tab === "note"} onClick={() => setTab("note")} icon={StickyNote} label="Note" />
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "recipe" && <RecipeTab onSelect={onSelectRecipe} />}
          {tab === "event" && <EventTab onCreated={onSelectRecipe} />}
          {tab === "note" && <NoteTab onSubmit={onCreateNote} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Book;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "bg-garnish-100 text-garnish-700"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// --- Tab: Recipe (full recipes + quick meals, filtered via pill) --------

function RecipeTab({ onSelect }: { onSelect: (recipeId: string) => void }) {
  // Filter pill — "all" means any recipe, "full" means just full recipes,
  // "quick_meal" means just quick meals. Matches the main RecipeBrowser
  // pattern so the meal-plan experience feels consistent with browsing.
  const [typeFilter, setTypeFilter] = useState<RecipeType | "all">("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  // IMPORTANT: all hooks must be called unconditionally, so useQuery runs
  // even when the create form is shown. React's Rules of Hooks — changing
  // the hook count between renders crashes the whole tree.
  //
  // placeholderData: keepPreviousData keeps the old list on-screen while
  // the new search fires, which avoids the skeleton flicker on every
  // keystroke.
  const { data, isLoading } = useQuery({
    queryKey: [
      "recipes",
      {
        q: search || undefined,
        recipe_type: typeFilter === "all" ? undefined : typeFilter,
      },
    ],
    queryFn: () =>
      listRecipes({
        q: search || undefined,
        recipe_type: typeFilter === "all" ? undefined : typeFilter,
      }),
    placeholderData: keepPreviousData,
  });

  if (creating) {
    return (
      <QuickMealCreateForm
        onCancel={() => setCreating(false)}
        onCreated={onSelect}
      />
    );
  }

  // Backend already excludes events from the default library view.
  const recipes = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes and quick meals..."
          autoFocus
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>

      {/* Pill filter — All / Recipes / Quick meals */}
      <div className="flex gap-2">
        {(
          [
            { value: "all", label: "All" },
            { value: "full", label: "Recipes" },
            { value: "quick_meal", label: "Quick meals" },
          ] as const
        ).map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setTypeFilter(p.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              typeFilter === p.value
                ? "bg-garnish-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <RecipeListSkeleton />
      ) : recipes.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          {search ? "No matches." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-1">
          {recipes.map((r: RecipeSummary) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-garnish-50"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gradient-to-br from-garnish-50 to-garnish-100">
                  {r.image_url ? (
                    <img src={r.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-garnish-300">
                      {r.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{r.title}</p>
                  <p className="flex gap-2 text-xs text-gray-500">
                    {r.recipe_type === "quick_meal" && <span>Quick meal</span>}
                    {r.category && (
                      <span className="capitalize">
                        {r.recipe_type === "quick_meal" && "· "}
                        {r.category.replace("_", " ")}
                      </span>
                    )}
                    {r.primary_protein && <span>· {r.primary_protein}</span>}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Inline quick-meal creation. Kept at the bottom so the browse
          list is the primary affordance — creation is the fallback when
          search doesn't turn up what the user wanted. */}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-600 hover:border-garnish-400 hover:bg-garnish-50 hover:text-garnish-700"
      >
        <Plus className="h-4 w-4" />
        Create a new quick meal
      </button>
    </div>
  );
}

function RecipeListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
      ))}
    </div>
  );
}

function QuickMealCreateForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (recipeId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<RecipeCategory | "">("");
  const [servings, setServings] = useState("");
  const [primaryProtein, setPrimaryProtein] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createRecipe({
        recipe_type: "quick_meal",
        title: title.trim(),
        category: category || null,
        servings: servings.trim() ? parseInt(servings, 10) : null,
        primary_protein: primaryProtein.trim() || null,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      onCreated(res.data.id);
    },
  });

  const err = mutation.error ? (mutation.error as ApiError).error?.message : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) mutation.mutate();
      }}
      className="space-y-3"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Frozen pizza, Taco Tuesday"
          autoFocus
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as RecipeCategory | "")}
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
          >
            <option value="">—</option>
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Servings
          </label>
          <input
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            placeholder="—"
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Primary protein <span className="text-xs font-normal text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={primaryProtein}
          onChange={(e) => setPrimaryProtein(e.target.value)}
          placeholder="e.g. chicken, tofu, beef"
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>

      <p className="text-xs text-gray-500">
        Quick meals live in your recipe library so you can reuse them and filter by category or protein.
      </p>

      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={mutation.isPending}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
        >
          Back
        </button>
        <SubmitButton pending={mutation.isPending} disabled={!title.trim()}>
          Create & add
        </SubmitButton>
      </div>
    </form>
  );
}

// --- Tab: Event (browse existing + create new) -------------------------

function EventTab({ onCreated }: { onCreated: (recipeId: string) => void }) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  // Hooks before any conditional return — React's Rules of Hooks require
  // the hook count to stay stable across renders. placeholderData keeps
  // the previous list visible during the search refetch to avoid a
  // per-keystroke skeleton flicker.
  const { data, isLoading } = useQuery({
    queryKey: ["recipes", { q: search || undefined, recipe_type: "event", limit: 5 }],
    queryFn: () =>
      listRecipes({ q: search || undefined, recipe_type: "event", limit: 5 }),
    placeholderData: keepPreviousData,
  });

  if (creating) {
    return (
      <EventCreateForm
        initialTitle={search}
        onCancel={() => setCreating(false)}
        onCreated={onCreated}
      />
    );
  }

  const events = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search past events..."
          autoFocus
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>

      {isLoading ? (
        <RecipeListSkeleton />
      ) : events.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          {search ? "No matching events." : "No past events yet."}
        </p>
      ) : (
        <ul className="space-y-1">
          {events.map((e: RecipeSummary) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onCreated(e.id)}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-garnish-50"
              >
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{e.title}</p>
                  {e.description && (
                    <p className="truncate text-xs text-gray-500">{e.description}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Always-available create affordance. When the user has typed a
          search that doesn't match anything, the create form pre-fills
          with their query so they don't have to retype. */}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-600 hover:border-garnish-400 hover:bg-garnish-50 hover:text-garnish-700"
      >
        <Plus className="h-4 w-4" />
        {search ? `Create "${search}"` : "Create a new event"}
      </button>
    </div>
  );
}

function EventCreateForm({
  initialTitle,
  onCancel,
  onCreated,
}: {
  initialTitle: string;
  onCancel: () => void;
  onCreated: (recipeId: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createRecipe({
        recipe_type: "event",
        title: title.trim(),
        notes: notes.trim() || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      onCreated(res.data.id);
    },
  });

  const err = mutation.error ? (mutation.error as ApiError).error?.message : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) mutation.mutate();
      }}
      className="space-y-3"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Event name
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dinner at Mom's, Book club"
          autoFocus
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Details <span className="text-xs font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything you'll want to remember later"
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={mutation.isPending}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
        >
          Back
        </button>
        <SubmitButton pending={mutation.isPending} disabled={!title.trim()}>
          Create & add
        </SubmitButton>
      </div>
    </form>
  );
}

// --- Tab: Note (not a recipe — just a freeform note on the entry) -------

function NoteTab({ onSubmit }: { onSubmit: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSubmit(title.trim());
      }}
      className="space-y-3"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Note
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Takeout, Leftovers from Tuesday"
          autoFocus
          className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
        />
        <p className="mt-1.5 text-xs text-gray-500">
          Notes are just reminders — they don't go into your recipe library or grocery list.
        </p>
      </div>
      <SubmitButton pending={false} disabled={!title.trim()}>
        Add note
      </SubmitButton>
    </form>
  );
}

function SubmitButton({
  pending,
  disabled,
  children,
}: {
  pending: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
