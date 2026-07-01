"use client";

import { useParams } from "next/navigation";
import ItemCreatePage from "@/components/item-create/page";

export default function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  const itemId = Number(id);

  if (!Number.isFinite(itemId)) return null;

  return <ItemCreatePage mode="edit" itemId={itemId} />;
}
