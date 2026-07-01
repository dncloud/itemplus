"use client";

import { useParams } from "next/navigation";
import ItemsPageClient from "../../items-page-client";

export default function ItemsPaginatedPage() {
  const params = useParams<{ page: string }>();
  const page = Number(params.page) || 1;
  return <ItemsPageClient pageOverride={page} />;
}
