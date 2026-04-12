import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

type Broadcast =
  | { action: "item_added"; item: GroceryListItem; actor_apikey: string }
  | { action: "item_updated"; item: GroceryListItem; actor_apikey: string }
  | { action: "item_checked"; item: GroceryListItem; actor_apikey: string }
  | { action: "item_unchecked"; item: GroceryListItem; actor_apikey: string }
  | { action: "item_removed"; item_id: number; actor_apikey: string }
  | { action: "list_refreshed"; list: GroceryList; actor_apikey: string };

const QUERY_KEY = ["groceryList"] as const;

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
          const isOwnAction = data.actor_apikey === user.id;
          const hasOptimistic =
            data.action === "item_checked" || data.action === "item_unchecked";
          if (isOwnAction && hasOptimistic) return;

          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
      }
    );
    return () => { subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const generate = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      generateGroceryList(from, to),
    onSuccess: (res) => {
      queryClient.setQueryData(QUERY_KEY, res);
    },
  });

  const addItem = useMutation({
    mutationFn: (input: {
      name: string;
      quantity?: number;
      unit?: string;
      category?: GroceryCategory;
      store?: string;
    }) => addGroceryItem(input),
    onSuccess: (res) => {
      queryClient.setQueryData(QUERY_KEY, (old: { data: GroceryList } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: { ...old.data, items: [...old.data.items, res.data] },
        };
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: { name?: string; quantity?: number; unit?: string; category?: GroceryCategory; store?: string };
    }) => updateGroceryItem(id, input),
    onSuccess: (res) => {
      queryClient.setQueryData(QUERY_KEY, (old: { data: GroceryList } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.map((i) => (i.id === res.data.id ? res.data : i)),
          },
        };
      });
    },
  });

  const checkItem = useMutation({
    mutationFn: (id: number) => checkGroceryItem(id),
    onMutate: (id) => {
      queryClient.setQueryData(QUERY_KEY, (old: { data: GroceryList } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.map((i) =>
              i.id === id ? { ...i, checked: true } : i
            ),
          },
        };
      });
    },
    onSuccess: (res) => {
      queryClient.setQueryData(QUERY_KEY, (old: { data: GroceryList } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.map((i) => (i.id === res.data.id ? res.data : i)),
          },
        };
      });
    },
  });

  const uncheckItem = useMutation({
    mutationFn: (id: number) => uncheckGroceryItem(id),
    onMutate: (id) => {
      queryClient.setQueryData(QUERY_KEY, (old: { data: GroceryList } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.map((i) =>
              i.id === id ? { ...i, checked: false } : i
            ),
          },
        };
      });
    },
    onSuccess: (res) => {
      queryClient.setQueryData(QUERY_KEY, (old: { data: GroceryList } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.map((i) => (i.id === res.data.id ? res.data : i)),
          },
        };
      });
    },
  });

  const removeItem = useMutation({
    mutationFn: (id: number) => removeGroceryItem(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData(QUERY_KEY, (old: { data: GroceryList } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.filter((i) => i.id !== id),
          },
        };
      });
    },
  });

  const clearChecked = useMutation({
    mutationFn: () => clearCheckedItems(),
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEY, (old: { data: GroceryList } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            items: old.data.items.filter((i) => !i.checked),
          },
        };
      });
    },
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
