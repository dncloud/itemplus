"use client";

import ItemCreatePage from "@/components/item-create/page";
import { useApp } from "@/lib/app-context";

export default function NewItemPage() {
  const { can } = useApp();
  if (!can("items.write")) {
    return <p className="py-10 text-center text-gray-500 dark:text-gray-400">Keine Berechtigung</p>;
  }
  return <ItemCreatePage />;
}
