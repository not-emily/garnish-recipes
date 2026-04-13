import { useState, useMemo } from "react";
import {
  RefreshCw,
  Plus,
  Loader2,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useGroceryList } from "@/hooks/useGroceryList";
import { useHousehold } from "@/contexts/HouseholdContext";
import { addGroceryStore, renameGroceryStore, removeGroceryStore } from "@/api/groceryLists";
import type { GroceryListItem, GroceryCategory } from "@/types/grocery";
import { GROCERY_CATEGORIES } from "@/types/grocery";
import { categorizeIngredient } from "@/lib/categorize";
import { SwipeableGroceryItem } from "@/components/grocery/SwipeableGroceryItem";
import { todayIso, addDays, formatMonthDay } from "@/lib/weekUtils";

export function GroceryList() {
  const { household, setHousehold } = useHousehold();
  const [addingStore, setAddingStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [showGenerateRange, setShowGenerateRange] = useState(false);
  const [showManageStores, setShowManageStores] = useState(false);

  const {
    groceryList,
    isLoading,
    isError,
    generate,
    addItem,
    updateItem,
    checkItem,
    uncheckItem,
    removeItem,
    clearChecked,
  } = useGroceryList();

  const [storeFilter, setStoreFilter] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [checkedOpen, setCheckedOpen] = useState(false);

  const myRole = household?.my_role ?? "member";
  const myPerm = household?.my_grocery_permission ?? "read";
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";
  const canEdit = isOwnerOrAdmin || myPerm === "full";
  const canGenerate = canEdit;
  const canAdd = canEdit || myPerm === "contribute";

  const items = groceryList?.items ?? [];
  const filtered = storeFilter
    ? items.filter((i) => i.store === storeFilter)
    : items;
  const unchecked = filtered.filter((i) => !i.checked);
  const checked = filtered.filter((i) => i.checked);

  const grouped = useMemo(() => {
    const groups = new Map<GroceryCategory, GroceryListItem[]>();
    for (const item of unchecked) {
      const cat = item.category as GroceryCategory;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    // Sort groups by the canonical category order
    const order = GROCERY_CATEGORIES.map((c) => c.value);
    return Array.from(groups.entries()).sort(
      (a, b) => order.indexOf(a[0]) - order.indexOf(b[0])
    );
  }, [unchecked]);

  const stores = household?.stores ?? [];
  const hasItems = items.length > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      <PageHeader
        title="Grocery List"
        subtitle={
          groceryList?.generated_from && groceryList?.generated_to
            ? `Generated from ${formatMonthDay(groceryList.generated_from)} – ${formatMonthDay(groceryList.generated_to)}`
            : undefined
        }
      />

      {/* Action bar */}
      {(canGenerate || canAdd) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {canGenerate && (
            <button
              type="button"
              onClick={() => setShowGenerateRange(true)}
              disabled={generate.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-garnish-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:opacity-60"
            >
              {generate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {hasItems ? "Refresh from Meal Plan" : "Generate from Meal Plan"}
            </button>
          )}
          {canAdd && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          )}
        </div>
      )}

      {/* Store filter pills */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        {stores.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setStoreFilter(null)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                storeFilter === null
                  ? "bg-garnish-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {stores.map((s: string) => {
              const count = items.filter((i) => i.store === s && !i.checked).length;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStoreFilter(storeFilter === s ? null : s)}
                  disabled={count === 0 && storeFilter !== s}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    storeFilter === s
                      ? "bg-garnish-600 text-white"
                      : count === 0
                        ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s}{count > 0 && ` (${count})`}
                </button>
              );
            })}
          </>
        )}
        {canAdd && addingStore ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = newStoreName.trim();
              if (trimmed && household && !stores.includes(trimmed)) {
                addGroceryStore(trimmed).then((res) => {
                  setHousehold({ ...household, stores: res.data.stores });
                  setAddingStore(false);
                  setNewStoreName("");
                });
              }
            }}
          >
            <input
              type="text"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="Store name"
              autoFocus
              className="w-28 rounded-full border border-gray-300 px-3 py-1 text-xs focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
            <button
              type="submit"
              disabled={!newStoreName.trim()}
              className="rounded-full bg-garnish-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setAddingStore(false); setNewStoreName(""); }}
              className="rounded-full p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : canAdd ? (
          <button
            type="button"
            onClick={() => setAddingStore(true)}
            className="whitespace-nowrap rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs font-medium text-gray-500 hover:border-garnish-400 hover:text-garnish-600"
          >
            {stores.length === 0 ? "+ Add Store" : "+"}
          </button>
        ) : null}
        {canAdd && stores.length > 0 && (
          <button
            type="button"
            onClick={() => setShowManageStores(true)}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Manage stores"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Add item form */}
      {showAddForm && (
        <AddItemForm
          stores={stores}
          mappings={groceryList?.mappings ?? []}
          onSubmit={(input) => {
            addItem.mutate(input, { onSuccess: () => setShowAddForm(false) });
          }}
          onCancel={() => setShowAddForm(false)}
          isPending={addItem.isPending}
        />
      )}

      {/* Loading / error / empty */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          Couldn't load the grocery list. Try again.
        </div>
      ) : !hasItems ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 px-6 py-12 text-center">
          <ShoppingCartEmpty />
          <p className="mt-3 text-sm text-gray-500">
            No items yet. Generate from your meal plan or add items manually.
          </p>
        </div>
      ) : (
        <>
          {/* Category groups */}
          {storeFilter && grouped.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              No items tagged for {storeFilter}.
            </p>
          )}
          {grouped.map(([category, categoryItems]) => {
            const meta = GROCERY_CATEGORIES.find((c) => c.value === category);
            return (
              <div key={category} className="mb-4">
                <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <span>{meta?.emoji ?? "📦"}</span>
                  <span>{meta?.label ?? category}</span>
                  <span className="text-xs font-normal text-gray-400">
                    ({categoryItems.length})
                  </span>
                </h3>
                <ul className="space-y-1">
                  {categoryItems.map((item) => (
                    <SwipeableGroceryItem
                      key={item.id}
                      enabled={canEdit}
                      onSwipeCheck={() => checkItem.mutate(item.id)}
                      onSwipeRemove={() => removeItem.mutate(item.id)}
                    >
                      <GroceryItemRow
                        item={item}
                        stores={stores}
                        canEdit={canEdit}
                        onCheck={() => checkItem.mutate(item.id)}
                        onUpdate={(input) =>
                          updateItem.mutate({ id: item.id, input })
                        }
                      />
                    </SwipeableGroceryItem>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* Checked section */}
          {checked.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setCheckedOpen((v) => !v)}
                className="mb-2 flex w-full items-center justify-between text-sm font-medium text-gray-500"
              >
                <span>Checked ({checked.length})</span>
                {checkedOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {checkedOpen && (
                <>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => clearChecked.mutate()}
                    disabled={clearChecked.isPending}
                    className="mb-2 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-60"
                  >
                    Clear all checked
                  </button>
                )}
                <ul className="space-y-1">
                  {checked.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2"
                    >
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => uncheckItem.mutate(item.id)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-garnish-300 bg-garnish-100 text-garnish-600"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      ) : (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center text-garnish-400">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <span className="flex-1 text-sm text-gray-400 line-through">
                        {formatItemLabel(item)}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeItem.mutate(item.id)}
                          className="rounded p-0.5 text-gray-300 hover:text-red-500"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                </>
              )}
            </div>
          )}
        </>
      )}

      {showManageStores && household && (
        <ManageStoresModal
          stores={stores}
          onRename={(oldName, newName) => {
            renameGroceryStore(oldName, newName).then((res) => {
              setHousehold({ ...household, stores: res.data.stores });
              if (storeFilter === oldName) setStoreFilter(newName);
            });
          }}
          onRemove={(name) => {
            removeGroceryStore(name).then((res) => {
              setHousehold({ ...household, stores: res.data.stores });
              if (storeFilter === name) setStoreFilter(null);
            });
          }}
          onClose={() => setShowManageStores(false)}
        />
      )}

      {showGenerateRange && (
        <GenerateRangeModal
          defaultFrom={groceryList?.generated_from ?? todayIso()}
          defaultTo={groceryList?.generated_to ?? addDays(todayIso(), 6)}
          onGenerate={(from, to) => {
            generate.mutate({ from, to }, {
              onSuccess: () => setShowGenerateRange(false),
            });
          }}
          onClose={() => setShowGenerateRange(false)}
          isPending={generate.isPending}
        />
      )}
    </div>
  );
}

function GroceryItemRow({
  item,
  stores,
  canEdit,
  onCheck,
  onUpdate,
}: {
  item: GroceryListItem;
  stores: string[];
  canEdit: boolean;
  onCheck: () => void;
  onUpdate: (input: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);

  const sources = item.source_entries
    .filter((s) => !s.removed)
    .map((s) => s.title);

  return (
    <li className="group flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-100 transition-shadow hover:shadow-sm">
      {canEdit ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCheck();
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300 text-transparent hover:border-garnish-400 hover:bg-garnish-50"
          aria-label={`Check off ${item.name}`}
        >
          <Check className="h-3 w-3" />
        </button>
      ) : (
        <div className="h-5 w-5 shrink-0" />
      )}

      <button
        type="button"
        onClick={() => canEdit && setEditing(true)}
        className={`min-w-0 flex-1 text-left ${canEdit ? "cursor-pointer" : ""}`}
      >
        <p className="text-sm text-gray-900">
          {formatItemLabel(item)}
        </p>
        {sources.length > 0 && (
          <p className="mt-0.5 truncate text-[10px] text-gray-400">
            {sources.join(" · ")}
          </p>
        )}
      </button>

      {item.store && (
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
          {item.store}
        </span>
      )}

      {editing && (
        <EditItemModal
          item={item}
          stores={stores}
          onSave={(input) => {
            onUpdate(input);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  );
}

function EditItemModal({
  item,
  stores,
  onSave,
  onClose,
}: {
  item: GroceryListItem;
  stores: string[];
  onSave: (input: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(item.category);
  const [store, setStore] = useState(item.store ?? "");
  const [quantity, setQuantity] = useState(item.quantity?.toString() ?? "");
  const [unit, setUnit] = useState(item.unit ?? "");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">{item.name}</h3>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Qty</label>
              <input
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GroceryCategory)}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            >
              {GROCERY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>

          {stores.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Store</label>
              <select
                value={store}
                onChange={(e) => setStore(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
              >
                <option value="">None</option>
                {stores.map((s: string) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                quantity: quantity.trim() ? Number(quantity) : null,
                unit: unit.trim() || null,
                category,
                store: store || null,
              })
            }
            className="flex-1 rounded-lg bg-garnish-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AddItemForm({
  stores,
  mappings,
  onSubmit,
  onCancel,
  isPending,
}: {
  stores: string[];
  mappings: { name: string; category: GroceryCategory; store: string | null }[];
  onSubmit: (input: {
    name: string;
    quantity?: number;
    unit?: string;
    category?: GroceryCategory;
    store?: string;
  }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState<GroceryCategory>("other");
  const [categoryManual, setCategoryManual] = useState(false);
  const [store, setStore] = useState("");
  const [storeManual, setStoreManual] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    const normalized = value.trim().toLowerCase();
    const mapping = mappings.find((m) => m.name === normalized);
    if (mapping) {
      if (!categoryManual) setCategory(mapping.category);
      if (!storeManual && mapping.store) setStore(mapping.store);
    } else {
      if (!categoryManual) setCategory(categorizeIngredient(value));
      if (!storeManual) setStore("");
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Item name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Paper towels, Almond milk"
            autoFocus
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Qty</label>
            <input
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="—"
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="—"
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as GroceryCategory);
                setCategoryManual(true);
              }}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            >
              {GROCERY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {stores.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Store</label>
            <select
              value={store}
              onChange={(e) => {
                setStore(e.target.value);
                setStoreManual(true);
              }}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            >
              <option value="">None</option>
              {stores.map((s: string) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            if (!name.trim()) return;
            onSubmit({
              name: name.trim(),
              quantity: quantity.trim() ? Number(quantity) : undefined,
              unit: unit.trim() || undefined,
              category,
              store: store || undefined,
            });
          }}
          disabled={isPending || !name.trim()}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add
        </button>
      </div>
    </div>
  );
}

function formatItemLabel(item: GroceryListItem): string {
  const parts = [item.name];
  if (item.quantity) {
    const qty = Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1);
    parts.push(item.unit ? `${qty} ${item.unit}` : String(qty));
    return `${parts[0]}, ${parts[1]}`;
  }
  return parts[0];
}

function ManageStoresModal({
  stores,
  onRename,
  onRemove,
  onClose,
}: {
  stores: string[];
  onRename: (oldName: string, newName: string) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Manage Stores</h3>

        <ul className="mt-4 space-y-2">
          {stores.map((s) => (
            <li
              key={s}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
            >
              {editing === s ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = editValue.trim();
                    if (trimmed && trimmed !== s) {
                      onRename(s, trimmed);
                    }
                    setEditing(null);
                  }}
                >
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                    className="min-w-0 flex-1 border-none bg-transparent px-0 py-1 text-sm focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded p-1 text-garnish-600 hover:bg-garnish-50"
                    aria-label="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-900">{s}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(s);
                      setEditValue(s);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-garnish-600"
                    aria-label={`Rename ${s}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(s)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    aria-label={`Delete ${s}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        {stores.length === 0 && (
          <p className="mt-4 text-center text-sm text-gray-400">No stores yet.</p>
        )}

        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function GenerateRangeModal({
  defaultFrom,
  defaultTo,
  onGenerate,
  onClose,
  isPending,
}: {
  defaultFrom: string;
  defaultTo: string;
  onGenerate: (from: string, to: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          Generate from Meal Plan
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Pick the date range to pull ingredients from.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onGenerate(from, to)}
            disabled={isPending || !from || !to || from > to}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

function ShoppingCartEmpty() {
  return (
    <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </svg>
  );
}

export default GroceryList;
