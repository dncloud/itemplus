/**
 * item+ API Client
 */

type Method = "GET" | "POST" | "PUT" | "DELETE";

export interface BrandingSettings {
  logo: string | null;
  subtitle: string;
  width: number;
}

class Api {
  baseURL = "";
  realm: "archive" | "collection" = "archive";

  private async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const res = await fetch(`${this.baseURL}/api${path}`, {
      method,
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      // Only auto-logout on explicit auth-check calls, not on random 401s
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth") && path === "/user") {
        try { await fetch(`${this.baseURL}/api/auth/logout`, { method: "POST", credentials: "include" }); } catch {}
        window.location.href = "/auth";
      }
      throw new Error("Unauthorized");
    }

    if (res.status === 204) return undefined as T;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  private get = <T>(path: string) => this.request<T>("GET", path);
  private post = <T>(path: string, body?: unknown) => this.request<T>("POST", path, body);
  private put = <T>(path: string, body?: unknown) => this.request<T>("PUT", path, body);
  private del = <T>(path: string) => this.request<T>("DELETE", path);

  // -- Auth --
  health = () => this.get<{ status: string; app: string; version: string }>("/health");
  getBranding = () => this.get<BrandingSettings>("/branding");
  updateBranding = (data: BrandingSettings) => this.put<BrandingSettings>("/admin/branding", data);
  resetBranding = () => this.del<BrandingSettings>("/admin/branding");

  // -- User --
  getMe = () => this.get<User>("/user");
  updateMe = (data: { display_name?: string; email?: string }) => this.put<User>("/user", data);
  getUsers = () => this.get<User[]>("/users");
  getInactiveUsers = () => this.get<User[]>("/users/inactive");
  getUsersLookup = () => this.get<{ id: number; name: string }[]>("/users/lookup");

  // -- Stats --
  getOverview = () => this.get<StatsOverview>("/stats/overview");
  getInventoryStats = () => this.get<{ warnings: InventoryWarning[] }>("/stats/inventory");
  getLocationStats = () => this.get<{ warnings: LocationWarning[] }>("/stats/locations");

  // -- Realm CRUD --
  getItems = (page = 1, search?: string, categoryId?: number, locationId?: number, sort = "updated", order = "desc") => {
    const params = new URLSearchParams({ page: String(page), per_page: "50", sort, order });
    if (search) params.set("search", search);
    if (categoryId) params.set("category_id", String(categoryId));
    if (locationId) params.set("location_id", String(locationId));
    return this.get<{ items: Item[]; total: number; total_quantity: number; total_value: number; page: number; per_page: number }>(`/${this.realm}/items?${params}`);
  };
  getItem = (id: number) => this.get<Item>(`/${this.realm}/items/${id}`);
  createItem = (data: Partial<Item>) => this.post<Item>(`/${this.realm}/items`, data);
  updateItem = (id: number, data: Partial<Item>) => this.put<Item>(`/${this.realm}/items/${id}`, data);
  deleteItem = (id: number) => this.del(`/${this.realm}/items/${id}`);

  getCategories = () => this.get<Category[]>(`/${this.realm}/categories`);
  createCategory = (data: Partial<Category>) => this.post<Category>(`/${this.realm}/categories`, data);
  updateCategory = (id: number, data: Partial<Category>) => this.put<Category>(`/${this.realm}/categories/${id}`, data);
  deleteCategory = (id: number) => this.del(`/${this.realm}/categories/${id}`);

  getProperties = (categoryId?: number) => {
    const params = categoryId ? `?category_id=${categoryId}` : "";
    return this.get<Property[]>(`/${this.realm}/properties${params}`);
  };
  createProperty = (data: Partial<Property>) => this.post<Property>(`/${this.realm}/properties`, data);
  updateProperty = (id: number, data: Partial<Property>) => this.put<Property>(`/${this.realm}/properties/${id}`, data);
  deleteProperty = (id: number) => this.del(`/${this.realm}/properties/${id}`);

  getLocations = () => this.get<Location[]>(`/${this.realm}/locations`);
  createLocation = (data: Partial<Location>) => this.post<Location>(`/${this.realm}/locations`, data);
  updateLocation = (id: number, data: Partial<Location>) => this.put<Location>(`/${this.realm}/locations/${id}`, data);
  deleteLocation = (id: number) => this.del(`/${this.realm}/locations/${id}`);

  getManufacturers = () => this.get<Vendor[]>(`/${this.realm}/manufacturers`);
  getSuppliers = () => this.get<Vendor[]>(`/${this.realm}/suppliers`);
  getVendors = () => this.get<Vendor[]>(`/${this.realm}/vendors`);

  // -- Print --
  printItemQR = (itemId: number, copies = 1) => this.post<{ status: string; qr_content: string }>(`/print/${this.realm}/item/${itemId}`, { copies });
  printLocationQR = (locationId: number, copies = 1) => this.post<{ status: string; qr_content: string }>(`/print/${this.realm}/location/${locationId}`, { copies });
  getPrinterStatus = () => this.get<{ reachable: boolean; host: string; port: number; speed: number; density: number; label_width: number; label_height: number; gap: number }>("/print/status");
  updatePrinterConfig = (data: Record<string, unknown>) => this.put<{ status: string }>("/print/config", data);

  // -- Checkout --
  getCheckoutRequests = () => this.get<CheckoutRequest[]>("/checkout/requests");
  createCheckoutRequest = (data: { realm: string; item_id: number; requested_duration_days?: number; notes?: string }) =>
    this.post<CheckoutRequest>("/checkout/request", data);
  approveRequest = (id: number) => this.put<CheckoutRequest>(`/checkout/requests/${id}/approve`);
  rejectRequest = (id: number) => this.put<CheckoutRequest>(`/checkout/requests/${id}/reject`);
  getActiveCheckouts = () => this.get<ActiveCheckout[]>(`/checkouts/${this.realm}/active`);
  getCheckoutHistory = () => this.get<ActiveCheckout[]>(`/checkouts/${this.realm}/history`);
  getMyOverdueCheckouts = () => this.get<ActiveCheckout[]>("/checkouts/my/overdue");
  checkoutItem = (itemId: number, data?: { user_id?: number; notes?: string; due_date?: string }) =>
    this.post<ActiveCheckout>(`/checkout/${this.realm}/${itemId}`, data || {});
  checkinItem = (itemId: number) => this.post<{ status: string }>(`/checkin/${this.realm}/${itemId}`, {});

  // -- File upload (special handling) --
  uploadAttachment = async (itemId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${this.baseURL}/api/${this.realm}/items/${itemId}/attachments`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  };
  deleteAttachment = (id: number) => this.del(`/${this.realm}/attachments/${id}`);
  updateAttachment = (id: number, data: Partial<Attachment>) => this.put<Attachment>(`/${this.realm}/attachments/${id}`, data);
  addLinkAttachment = (itemId: number, data: { url: string; filename?: string; description?: string; order?: number }) =>
    this.post<Attachment>(`/${this.realm}/items/${itemId}/attachments/link`, data);

  // Property file upload (for file/image property types)
  uploadPropertyFile = async (itemId: number, propertyId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${this.baseURL}/api/${this.realm}/items/${itemId}/properties/${propertyId}/upload`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json() as Promise<{ status: string; value: Record<string, unknown> }>;
  };
}

// -- Types --

export interface User {
  id: number;
  sub?: string;
  email?: string;
  name?: string;
  is_admin: boolean;
  permissions?: string[];
  last_ip?: string;
  last_device?: string;
  is_active: boolean;
  last_login?: string;
  created_at?: string;
}

export interface Item {
  id: number;
  name: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  location_id?: number;
  location_name?: string;
  quantity: number;
  is_consumable: boolean;
  minimum_quantity?: number;
  manufacturer_id?: number;
  manufacturer_name?: string;
  supplier_id?: number;
  supplier_name?: string;
  vendor_id?: number;
  vendor_name?: string;
  purchase_date?: string;
  purchase_price?: number;
  purchase_currency?: string;
  properties?: Record<string, unknown>;
  properties_display?: Record<string, unknown>;
  checked_out_to?: { user_id: number; user_name?: string; due_date?: string; checkout_id: number; since?: string };
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  color?: string;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export interface Property {
  id: number;
  category_id: number;
  name: string;
  property_type: string;
  unit?: string;
  options?: Record<string, unknown>;
  required: boolean;
  show_in_list: boolean;
  display_width: "third" | "half" | "full";
  position: number;
}

export interface Attachment {
  id: number;
  item_id: number;
  filename: string;
  file_path: string;
  attachment_type: string;
  url?: string;
  description?: string;
  gallery?: boolean;
  order: number;
  size?: number;
}

export interface Location {
  id: number;
  name: string;
  description?: string;
  color?: string;
  parent_id?: number | null;
  manager_id?: number | null;
  image?: string;
  capacity?: number;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export interface Vendor {
  id: number;
  name: string;
  logo?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: Record<string, string>;
  contact_person?: string;
  customer_number?: string;
  account_manager?: string;
  support_email?: string;
  support_phone?: string;
  support_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StatsOverview {
  archive: RealmStats;
  collection: RealmStats;
}

export interface RealmStats {
  items: number;
  categories: number;
  locations: number;
  properties: number;
  total_value: number;
  total_quantity: number;
  avg_price: number;
  recently_added: { id: number; name: string; created_at?: string }[];
  top_by_value: { id: number; name: string; value: number }[];
  top_by_quantity: { id: number; name: string; quantity: number }[];
  by_category: CategoryStats[];
}

export interface CategoryStats {
  id: number;
  name: string;
  items: number;
  value: number;
}

export interface InventoryWarning {
  realm: string;
  item_id: number;
  name: string;
  level: "low_stock" | "out_of_stock";
  quantity: number;
  minimum?: number;
}

export interface LocationWarning {
  realm: string;
  location_id: number;
  name: string;
  level: "warning" | "almost_full" | "full";
  used: number;
  capacity: number;
}

export interface CheckoutRequest {
  id: number;
  realm: string;
  item_id: number;
  item_name?: string;
  user_id: number;
  user_name?: string;
  status: string;
  requested_duration_days?: number;
  approved_by?: number;
  approved_by_name?: string;
  notes?: string;
  created_at?: string;
}

export interface ActiveCheckout {
  id: number;
  realm: string;
  item_id: number;
  item_name?: string;
  user_id: number;
  user_name?: string;
  status: string;
  due_date?: string;
  returned_at?: string;
  notes?: string;
  created_at?: string;
  duration_days?: number;
  is_overdue?: boolean;
  was_overdue?: boolean;
  overdue_days?: number;
}

export const api = new Api();

/** Validate that a URL uses a safe protocol (http/https only). */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
