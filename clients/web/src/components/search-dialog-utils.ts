"use client";

import { api, type Category, type Item, type Location } from "@/lib/api";

export async function fetchSearchDialogReferenceData() {
  const [categories, locations] = await Promise.all([api.getCategories(), api.getLocations()]);
  return { categories, locations };
}

export async function searchDialogItems(query: string) {
  const res = await api.getItems(1, query);
  return res.items.slice(0, 8);
}

export function filterSearchDialogCategories(categories: Category[], query: string) {
  const normalized = query.toLowerCase();
  return (normalized ? categories.filter((category) => category.name.toLowerCase().includes(normalized)) : categories).slice(0, normalized ? 10 : 5);
}

export function filterSearchDialogLocations(locations: Location[], query: string) {
  const normalized = query.toLowerCase();
  return (normalized ? locations.filter((location) => location.name.toLowerCase().includes(normalized)) : locations).slice(0, normalized ? 10 : 5);
}

export function hasSearchDialogResults(
  items: Item[],
  categories: Category[],
  locations: Location[],
) {
  return items.length > 0 || categories.length > 0 || locations.length > 0;
}
