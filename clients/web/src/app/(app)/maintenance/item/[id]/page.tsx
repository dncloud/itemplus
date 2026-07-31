"use client";

import { useParams } from "next/navigation";
import { ItemMaintenancePageContent } from "@/components/maintenance/item-maintenance-page";

export default function ItemMaintenancePage() {
  const { id } = useParams<{ id: string }>();
  const itemId = Number(id);

  if (!Number.isFinite(itemId)) return null;

  return <ItemMaintenancePageContent itemId={itemId} />;
}
