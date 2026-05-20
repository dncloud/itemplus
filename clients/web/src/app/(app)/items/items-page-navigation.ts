export function buildItemsPageUrl(
  opts: { page?: number; q?: string; category?: number; location?: number; status?: string; sort?: string; order?: string },
) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.category) params.set("category", String(opts.category));
  if (opts.location) params.set("location", String(opts.location));
  if (opts.status) params.set("status", opts.status);
  if (opts.sort && opts.sort !== "id") params.set("sort", opts.sort);
  if (opts.order && opts.order !== "desc") params.set("order", opts.order);
  const queryString = params.toString() ? `?${params.toString()}` : "";
  const page = opts.page ?? 1;
  return page === 1 ? `/items${queryString}` : `/items/page/${page}${queryString}`;
}

export function buildPaginationPages(page: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, -1, totalPages];
  if (page >= totalPages - 3) return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, -1, page - 1, page, page + 1, -1, totalPages];
}
