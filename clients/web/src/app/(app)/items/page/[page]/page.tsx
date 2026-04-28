"use client";

import { useParams } from "next/navigation";
import ItemsPage from "../../page";

export default function ItemsPaginatedPage() {
  const params = useParams<{ page: string }>();
  const page = Number(params.page) || 1;
  return <ItemsPage pageOverride={page} />;
}
