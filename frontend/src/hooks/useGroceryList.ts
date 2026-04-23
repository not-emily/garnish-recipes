import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGroceryList,
  generateGroceryList,
  addGroceryItem,
  updateGroceryItem,
  checkGroceryItem,
  uncheckGroceryItem,
  removeGroceryItem,
  clearCheckedItems,
} from "@/api/groceryLists";
import type { GroceryList, GroceryListItem, GroceryCategory } from "@/types/grocery";
import { getConsumer } from "@/lib/cable";
import { useAuth } from "@/contexts/AuthContext";
import { useOptimisticMutation } from "@/lib/useOptimisticMutation";

type Broadcast =
  | { action: "item_added"; item: GroceryListItem; actor_apikey: string }
  | { action: "item_updated"; item: GroceryListItem; actor_apikey: string }
  | { action: "item_checked"; item: GroceryListItem; actor_apikey: string }
  | { action: "item_unchecked"; item: GroceryListItem; actor_apikey: string }
  | { action: "item_removed"; item_id: number; actor_apikey: string }
  | { action: "list_refreshed"; list: GroceryList; actor_apikey: string };

const QUERY_KEY = ["groceryList"] as const;

type CacheShape = { data: GroceryList } | undefined;

function patchList(
  old: CacheShape,
  patch: (items: GroceryListItem[]) => GroceryListItem[]
): CacheShape {
  if (!old) return old;
  return { ...old, data: { ...old.data, items: patch(old.data.items) } };
}

export function useGroceryList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getGroceryList,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!user) return;
    const consumer = getConsumer();
    const subscription = consumer.subscriptions.create(
      { channel: "GroceryListChannel" },
      {
        received(data: Broadcast) {
          // Drop malformed payloads defensively — a broadcast missing
          // required fields would leave ghost rows in the cache after the
          // invalidation refetch lands.
          if (!data || typeof data !== "object" || !("action" in data)) return;
          const isOwnAction = data.actor_apikey === user.id;
          // Every mutation we fire has its own optimistic update via
          // useOptimisticMutation. Invalidating on the echo of our own
          // broadcast double-applies the change: the optimistic version
          // plus the server's refetched copy, producing duplicate or
          // stuck-pending rows. Let the mutation's own onSuccess reconcile.
          if (isOwnAction) return;

          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
      }
    );
    return () => { subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const generate = useOptimisticMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      generateGroceryList(from, to),
    onSuccess: (res, _vars, qc) => {
      qc.setQueryData(QUERY_KEY, res);
    },
    errorToast: "Couldn't generate grocery list",
  });

  const addItem = useOptimisticMutation({
    mutationFn: (input: {
      name: string;
      quantity?: number;
      unit?: string;
      category?: GroceryCategory;
      store?: string;
    }) => addGroceryItem(input),
    onOptimisticUpdate: (input, qc) => {
      const tempId = -Date.now();
      const prev = qc.getQueryData<CacheShape>(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, (old: CacheShape) =>
        patchList(old, (items) => [
          ...items,
          {
            id: tempId,
            name: input.name,
            quantity: input.quantity ?? null,
            unit: input.unit ?? null,
            category: input.category ?? "other",
            store: input.store ?? null,
            source_type: "manual",
            source_entries: [],
            checked: false,
            position: items.length,
            added_by: { id: "me", name: "You" },
            _pending: true,
          },
        ])
      );
      return () => qc.setQueryData(QUERY_KEY, prev);
    },
    onSuccess: (res, _vars, qc) => {
      // Replace the most recent temp entry with the server's response. Matches
      // by the _pending flag so concurrent adds don't stomp each other.
      qc.setQueryData(QUERY_KEY, (old: CacheShape) =>
        patchList(old, (items) => {
          const idx = items.findIndex((i) => i._pending && i.id < 0);
          if (idx === -1) return [...items, res.data];
          const next = items.slice();
          next[idx] = res.data;
          return next;
        })
      );
    },
    successToast: (res) => `Added ${res.data.name}`,
    errorToast: "Couldn't add item",
    cancelKeys: [QUERY_KEY],
  });

  const updateItem = useOptimisticMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: { name?: string; quantity?: number; unit?: string; category?: GroceryCategory; store?: string };
    }) => updateGroceryItem(id, input),
    onOptimisticUpdate: ({ id, input }, qc) => {
      const prev = qc.getQueryData<CacheShape>(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, (old: CacheShape) =>
        patchList(old, (items) =>
          items.map((i) => (i.id === id ? { ...i, ...input, _pending: true } : i))
        )
      );
      return () => qc.setQueryData(QUERY_KEY, prev);
    },
    onSuccess: (res, _vars, qc) => {
      qc.setQueryData(QUERY_KEY, (old: CacheShape) =>
        patchList(old, (items) =>
          items.map((i) => (i.id === res.data.id ? res.data : i))
        )
      );
    },
    errorToast: "Couldn't save change",
    cancelKeys: [QUERY_KEY],
  });

  const checkItem = useOptimisticMutation({
    mutationFn: (id: number) => checkGroceryItem(id),
    onOptimisticUpdate: (id, qc) => {
      const prev = qc.getQueryData<CacheShape>(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, (old: CacheShape) =>
        patchList(old, (items) =>
          items.map((i) => (i.id === id ? { ...i, checked: true, _pending: true } : i))
        )
      );
      return () => qc.setQueryData(QUERY_KEY, prev);
    },
    onSuccess: (res, _vars, qc) => {
      qc.setQueryData(QUERY_KEY, (old: CacheShape) =>
        patchList(old, (items) =>
          items.map((i) => (i.id === res.data.id ? res.data : i))
        )
      );
    },
    errorToast: "Couldn't check off item",
    cancelKeys: [QUERY_KEY],
  });

  const uncheckItem = useOptimisticMutation({
    mutationFn: (id: number) => uncheckGroceryItem(id),
    onOptimisticUpdate: (id, qc) => {
      const prev = qc.getQueryData<CacheShape>(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, (old: CacheShape) =>
        patchList(old, (items) =>
          items.map((i) => (i.id === id ? { ...i, checked: false, _pending: true } : i))
        )
      );
      return () => qc.setQueryData(QUERY_KEY, prev);
    },
    onSuccess: (res, _vars, qc) => {
      qc.setQueryData(QUERY_KEY, (old: CacheShape) =>
        patchList(old, (items) =>
          items.map((i) => (i.id === res.data.id ? res.data : i))
        )
      );
    },
    errorToast: "Couldn't uncheck item",
    cancelKeys: [QUERY_KEY],
  });

  const removeItem = useOptimisticMutation({
    mutationFn: (id: number) => removeGroceryItem(id),
    onOptimisticUpdate: (id, qc) => {
      const prev = qc.getQueryData<CacheShape>(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, (old: CacheShape) =>
        patchList(old, (items) => items.filter((i) => i.id !== id))
      );
      return () => qc.setQueryData(QUERY_KEY, prev);
    },
    errorToast: "Couldn't remove item",
    cancelKeys: [QUERY_KEY],
  });

  const clearChecked = useOptimisticMutation({
    mutationFn: () => clearCheckedItems(),
    onOptimisticUpdate: (_vars, qc) => {
      const prev = qc.getQueryData<CacheShape>(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, (old: CacheShape) =>
        patchList(old, (items) => items.filter((i) => !i.checked))
      );
      return () => qc.setQueryData(QUERY_KEY, prev);
    },
    errorToast: "Couldn't clear checked items",
    cancelKeys: [QUERY_KEY],
  });

  return {
    groceryList: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    generate,
    addItem,
    updateItem,
    checkItem,
    uncheckItem,
    removeItem,
    clearChecked,
  };
}
