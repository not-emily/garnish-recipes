import { api } from "./client";
import type { GroceryList, GroceryListItem, GroceryCategory } from "@/types/grocery";

export function getGroceryList() {
  return api<{ data: GroceryList }>("/grocery_list");
}

export function generateGroceryList(from: string, to: string) {
  return api<{ data: GroceryList }>("/grocery_list/generate", {
    method: "POST",
    body: JSON.stringify({ from, to }),
  });
}

export function addGroceryItem(
  input: { name: string; quantity?: number; unit?: string; category?: GroceryCategory; store?: string }
) {
  return api<{ data: GroceryListItem }>("/grocery_list/items", {
    method: "POST",
    body: JSON.stringify({ item: input }),
  });
}

export function updateGroceryItem(
  itemId: number,
  input: { name?: string; quantity?: number; unit?: string; category?: GroceryCategory; store?: string }
) {
  return api<{ data: GroceryListItem }>(`/grocery_list/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ item: input }),
  });
}

export function checkGroceryItem(itemId: number) {
  return api<{ data: GroceryListItem }>(`/grocery_list/items/${itemId}/check`, {
    method: "PATCH",
  });
}

export function uncheckGroceryItem(itemId: number) {
  return api<{ data: GroceryListItem }>(`/grocery_list/items/${itemId}/uncheck`, {
    method: "PATCH",
  });
}

export function removeGroceryItem(itemId: number) {
  return api<void>(`/grocery_list/items/${itemId}`, {
    method: "DELETE",
  });
}

export function clearCheckedItems() {
  return api<void>("/grocery_list/checked", {
    method: "DELETE",
  });
}

export function addGroceryStore(name: string) {
  return api<{ data: { stores: string[] } }>("/grocery_list/stores", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function renameGroceryStore(oldName: string, newName: string) {
  return api<{ data: { stores: string[] } }>("/grocery_list/stores", {
    method: "PATCH",
    body: JSON.stringify({ old_name: oldName, new_name: newName }),
  });
}

export function removeGroceryStore(name: string) {
  return api<{ data: { stores: string[] } }>("/grocery_list/stores", {
    method: "DELETE",
    body: JSON.stringify({ name }),
  });
}
