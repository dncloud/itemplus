/**
 * item+ API Client
 */

import {
  buildQueryString,
  buildRecoverBackupForm,
  buildSingleFileForm,
  parseApiError,
  readEventStream,
} from "@/lib/api-helpers";

type Method = "GET" | "POST" | "PUT" | "DELETE";

export interface BrandingSettings {
  logo: string | null;
  subtitle: string;
  footerText: string;
  width: number;
}

export interface PrinterStatus {
  reachable: boolean;
  host: string;
  port: number;
}

export interface LabelTemplate {
  id: number;
  system_key?: string | null;
  name: string;
  description?: string | null;
  target: "item" | "location" | "both";
  dpi: number;
  width_mm: number;
  height_mm: number;
  gap_mm: number;
  speed: number;
  density: number;
  direction: 0 | 1;
  reference_x: number;
  reference_y: number;
  shift_x: number;
  shift_y: number;
  copies_default: number;
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
  tspl_template: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LabelTemplateVariable {
  key: string;
  label: string;
  target: "item" | "location" | "both";
  description: string;
}

export interface LabelTemplateMeta {
  targets: Array<"item" | "location" | "both">;
  dpis: number[];
  supported_commands: string[];
  variables: LabelTemplateVariable[];
}

export interface LabelTemplatePayload {
  name: string;
  description?: string | null;
  target: "item" | "location" | "both";
  dpi: number;
  width_mm: number;
  height_mm: number;
  gap_mm: number;
  speed: number;
  density: number;
  direction: 0 | 1;
  reference_x: number;
  reference_y: number;
  shift_x: number;
  shift_y: number;
  copies_default: number;
  is_default?: boolean;
  is_active?: boolean;
  tspl_template: string;
}

export interface ExternalSource {
  id: number;
  name: string;
  description?: string | null;
  source_type: "sftp";
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "ssh_key";
  known_host_key: string;
  base_path: string;
  is_active: boolean;
  has_password: boolean;
  has_private_key: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ExternalSourcePayload {
  name: string;
  description?: string | null;
  source_type: "sftp";
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "ssh_key";
  password?: string | null;
  private_key?: string | null;
  known_host_key: string;
  base_path: string;
  is_active?: boolean;
}

export interface ExternalSourceHostKeyInfo {
  algorithm: string;
  fingerprint_sha256: string;
  authorized_key: string;
}

export interface ExternalSourceBrowseEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_at?: string | null;
}

export interface ExternalSourceBrowseResult {
  source_id: number;
  current_path: string;
  parent_path: string;
  entries: ExternalSourceBrowseEntry[];
}

export interface AIProfile {
  id: string;
  name: string;
  provider: "openai" | "ollama";
  model: string;
  base_url: string;
  enabled: boolean;
  supports_vision: boolean;
  has_api_key: boolean;
  api_key_preview?: string;
  chat_prompt: string;
  parse_item_prompt: string;
  category_property_prompt: string;
  property_enhancement_prompt: string;
  chat_prompt_default: string;
  parse_item_prompt_default: string;
  category_property_prompt_default: string;
  property_enhancement_prompt_default: string;
}

export interface AISettings {
  active_profile_id: string;
  profiles: AIProfile[];
}

export interface AIProfilePayload {
  id: string;
  name: string;
  provider: "openai" | "ollama";
  model: string;
  base_url: string;
  api_key?: string;
  enabled: boolean;
  supports_vision: boolean;
  chat_prompt: string;
  parse_item_prompt: string;
  category_property_prompt: string;
  property_enhancement_prompt: string;
}

export interface AISettingsPayload {
  active_profile_id: string;
  profiles: AIProfilePayload[];
}

export interface AIConnectionTestResult {
  status: string;
  provider: string;
  model: string;
  output_text?: string;
  response_id?: string;
  request_id?: string;
}

export interface AIModelOption {
  id: string;
  owned_by?: string;
  created?: number;
}

export interface AIUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  reasoning_tokens?: number;
  web_search_requests?: number;
  web_fetch_requests?: number;
}

export interface AIParseItemIntentResult {
  intent: string;
  confidence: number;
  needs_confirmation: boolean;
  assistant_message: string;
  suggested_realm: "archive" | "collection";
  suggested_category_id?: number | null;
  suggested_category_name?: string;
  category_proposal?: AICategoryProposal | null;
  fields: Record<string, unknown>;
  properties: Record<string, unknown>;
  missing_required: string[];
  questions: string[];
  notes: string[];
  raw_prompt?: string;
  transport?: string;
  model?: string;
  provider?: string;
  usage?: AIUsage;
  context?: Record<string, unknown>;
}

export interface AIPropertyProposal {
  name: string;
  property_type: string;
  unit?: string;
  required?: boolean;
  show_in_list?: boolean;
  display_width?: "third" | "half" | "full";
  options?: string[];
}

export interface AICategoryProposal {
  reason?: string;
  name: string;
  description?: string;
  color?: string;
  manufacturer_name?: string;
  properties?: AIPropertyProposal[];
}

export interface AICategoryPropertySuggestionResult {
  confidence: number;
  needs_confirmation: boolean;
  assistant_message: string;
  questions: string[];
  notes: string[];
  properties: AIPropertyProposal[];
  raw_prompt?: string;
  raw_debug?: string;
  transport?: string;
  model?: string;
  provider?: string;
  usage?: AIUsage;
  context?: Record<string, unknown>;
}

export interface AIPropertyEnhancementSuggestionResult {
  confidence: number;
  needs_confirmation: boolean;
  assistant_message: string;
  questions: string[];
  notes: string[];
  property: AIPropertyProposal;
  raw_prompt?: string;
  raw_debug?: string;
  transport?: string;
  model?: string;
  provider?: string;
  usage?: AIUsage;
  context?: Record<string, unknown>;
}

export interface AIParseStreamEvent {
  type: "status" | "note" | "request" | "delta" | "raw" | "result" | "error" | "done";
  message?: string;
  delta?: string;
  result?: AIParseItemIntentResult;
}

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatResult {
  assistant_message: string;
  transport?: string;
  model?: string;
  provider?: string;
  usage?: AIUsage;
  context?: Record<string, unknown>;
}

export interface AIChatStreamEvent {
  type: "status" | "note" | "delta" | "raw" | "error" | "done";
  message?: string;
  delta?: string;
  result?: AIChatResult;
}

class Api {
  baseURL = "";
  realm: "archive" | "collection" = "archive";

  private apiURL(path: string) {
    return `${this.baseURL}/api${path}`;
  }

  private getStreamBaseURL() {
    if (this.baseURL) return this.baseURL;
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.origin);
    if (url.port === "3000") {
      url.port = "17117";
    }
    return url.origin;
  }

  private async toError(res: Response) {
    return parseApiError(res);
  }

  private async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const res = await fetch(this.apiURL(path), {
      method,
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      throw new Error("Unauthorized");
    }

    if (res.status === 204) return undefined as T;
    if (!res.ok) {
      throw await this.toError(res);
    }
    return res.json();
  }

  private async postForm<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(this.apiURL(path), {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      throw await this.toError(res);
    }
    return res.json() as Promise<T>;
  }

  private async downloadBlob(path: string): Promise<Blob> {
    const res = await fetch(this.apiURL(path), {
      credentials: "include",
    });
    if (!res.ok) {
      throw await this.toError(res);
    }
    return res.blob();
  }

  private get = <T>(path: string) => this.request<T>("GET", path);
  private post = <T>(path: string, body?: unknown) => this.request<T>("POST", path, body);
  private put = <T>(path: string, body?: unknown) => this.request<T>("PUT", path, body);
  private del = <T>(path: string) => this.request<T>("DELETE", path);

  private withQuery(path: string, values: Record<string, string | number | boolean | undefined | null>) {
    return `${path}${buildQueryString(values)}`;
  }

  private async handleStream(
    path: string,
    body: unknown,
    onEvent: (event: AIParseStreamEvent) => void,
  ) {
    const res = await fetch(`${this.getStreamBaseURL()}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw await this.toError(res);
    }
    await readEventStream(res, onEvent);
  }

  // -- Auth --
  health = () => this.get<{ status: string; app: string; version: string }>("/health");
  getBranding = () => this.get<BrandingSettings>("/branding");
  updateBranding = (data: BrandingSettings) => this.put<BrandingSettings>("/admin/branding", data);
  resetBranding = () => this.del<BrandingSettings>("/admin/branding");
  getAISettings = () => this.get<AISettings>("/admin/ai-settings");
  updateAISettings = (data: AISettingsPayload) => this.put<AISettings>("/admin/ai-settings", data);
  testAISettings = (data: AIProfilePayload) => this.post<AIConnectionTestResult>("/admin/ai-settings/test", data);
  listAIModels = (data: AIProfilePayload) => this.post<{ models: AIModelOption[] }>("/admin/ai-settings/models", data);
  chatWithAIStream = async (
    data: { messages: AIChatMessage[]; locale?: string; allow_web_search?: boolean; temp_image_id?: string },
    onEvent: (event: AIChatStreamEvent) => void,
  ) => this.handleStream("/ai/chat/stream", data, onEvent as (event: AIParseStreamEvent) => void);
  parseItemIntent = (data: { realm: "archive" | "collection"; prompt: string; barcode?: string; temp_image_id?: string; locale?: string; selected_category_id?: number; allow_web_search?: boolean; identify_only?: boolean }) => this.post<AIParseItemIntentResult>("/ai/parse-item-intent", data);
  parseItemIntentStream = async (
    data: { realm: "archive" | "collection"; prompt: string; barcode?: string; temp_image_id?: string; locale?: string; selected_category_id?: number; allow_web_search?: boolean; identify_only?: boolean },
    onEvent: (event: AIParseStreamEvent) => void,
  ) => this.handleStream("/ai/parse-item-intent/stream", data, onEvent);
  suggestCategoryProperties = (data: { realm: "archive" | "collection"; prompt: string; locale?: string; category_id: number; allow_web_search?: boolean }) =>
    this.post<AICategoryPropertySuggestionResult>("/ai/suggest-category-properties", data);
  suggestPropertyEnhancement = (data: { realm: "archive" | "collection"; prompt: string; locale?: string; category_id: number; property_id: number; allow_web_search?: boolean }) =>
    this.post<AIPropertyEnhancementSuggestionResult>("/ai/suggest-property-enhancement", data);

  // -- User --
  getMe = () => this.get<User>("/user");
  updateMe = (data: { display_name?: string; email?: string }) => this.put<User>("/user", data);
  deleteMe = () => this.del<void>("/user");
  getUsers = () => this.get<User[]>("/users");
  getInactiveUsers = () => this.get<User[]>("/users/inactive");
  getUsersLookup = () => this.get<{ id: number; name: string }[]>("/users/lookup");
  exportBackupBundle = async () => this.downloadBlob("/admin/export-bundle");
  recoverBackupBundle = async (file: File, options: { database: boolean; attachments: boolean; config: boolean }) => {
    return this.postForm<{ status: string; requires_restart?: boolean }>(
      "/admin/recover-bundle",
      buildRecoverBackupForm(file, options),
    );
  };

  // -- Stats --
  getOverview = () => this.get<StatsOverview>("/stats/overview");
  getInventoryStats = () => this.get<{ warnings: InventoryWarning[] }>("/stats/inventory");
  getLocationStats = () => this.get<{ warnings: LocationWarning[] }>("/stats/locations");
  getAIUsageStats = () => this.get<AIUsageStats>("/stats/ai-usage");

  // -- Realm CRUD --
  getItems = (
    page = 1,
    search?: string,
    categoryId?: number,
    locationId?: number,
    status?: string,
    sort = "updated",
    order = "desc",
    perPage = 50,
  ) => {
    return this.get<{ items: ItemWire[]; total: number; total_quantity: number; total_value: number; page: number; per_page: number }>(
      this.withQuery(`/${this.realm}/items`, {
        page,
        per_page: perPage,
        sort,
        order,
        search,
        category_id: categoryId,
        location_id: locationId,
        status,
      }),
    ).then((result) => ({
      ...result,
      items: result.items.map(normalizeItem),
    }));
  };
  getItem = (id: number) => this.get<ItemWire>(`/${this.realm}/items/${id}`).then(normalizeItem);
  createItem = (data: Partial<Item>) => this.post<ItemWire>(`/${this.realm}/items`, serializeItemPayload(data)).then(normalizeItem);
  updateItem = (id: number, data: Partial<Item>) => this.put<ItemWire>(`/${this.realm}/items/${id}`, serializeItemPayload(data)).then(normalizeItem);
  deleteItem = (id: number) => this.del(`/${this.realm}/items/${id}`);
  getItemsLookup = (excludeId?: number) => this.get<ItemComponent[]>(this.withQuery(`/${this.realm}/items/lookup`, { exclude_id: excludeId }));

  getCategories = () => this.get<Category[]>(`/${this.realm}/categories`);
  createCategory = (data: Partial<Category>) => this.post<Category>(`/${this.realm}/categories`, data);
  updateCategory = (id: number, data: Partial<Category>) => this.put<Category>(`/${this.realm}/categories/${id}`, data);
  deleteCategory = (id: number) => this.del(`/${this.realm}/categories/${id}`);

  getProperties = (categoryId?: number) => {
    return this.get<Property[]>(this.withQuery(`/${this.realm}/properties`, { category_id: categoryId }));
  };
  createProperty = (data: Partial<Property>) => this.post<Property>(`/${this.realm}/properties`, data);
  updateProperty = (id: number, data: Partial<Property>) => this.put<Property>(`/${this.realm}/properties/${id}`, data);
  deleteProperty = (id: number) => this.del(`/${this.realm}/properties/${id}`);

  getLocations = () => this.get<Location[]>(`/${this.realm}/locations`);
  createLocation = (data: Partial<Location>) => this.post<Location>(`/${this.realm}/locations`, data);
  updateLocation = (id: number, data: Partial<Location>) => this.put<Location>(`/${this.realm}/locations/${id}`, data);
  deleteLocation = (id: number) => this.del(`/${this.realm}/locations/${id}`);

  getManufacturers = () => this.get<Vendor[]>(`/${this.realm}/manufacturers`);
  createManufacturer = (data: Partial<Vendor>) => this.post<Vendor>(`/${this.realm}/manufacturers`, data);
  getSuppliers = () => this.get<Vendor[]>(`/${this.realm}/suppliers`);
  getVendors = () => this.get<Vendor[]>(`/${this.realm}/vendors`);
  getSalesPlatforms = () => this.get<Vendor[]>("/sales-platforms");

  // -- Print --
  printItemQR = (itemId: number, copies = 1) => this.post<{ status: string; qr_content: string }>(`/print/${this.realm}/item/${itemId}`, { copies });
  printLocationQR = (locationId: number, copies = 1) => this.post<{ status: string; qr_content: string }>(`/print/${this.realm}/location/${locationId}`, { copies });
  getPrinterStatus = () => this.get<PrinterStatus>("/print/status");
  updatePrinterConfig = (data: Record<string, unknown>) => this.put<{ status: string }>("/print/config", data);
  getLabelTemplateMeta = () => this.get<LabelTemplateMeta>("/print/templates/meta");
  getLabelTemplates = (target?: "item" | "location" | "both", includeInactive = false) => {
    return this.get<LabelTemplate[]>(
      this.withQuery("/print/templates", {
        target,
        include_inactive: includeInactive ? 1 : undefined,
      }),
    );
  };
  getLabelTemplate = (id: number) => this.get<LabelTemplate>(`/print/templates/${id}`);
  createLabelTemplate = (data: LabelTemplatePayload) => this.post<LabelTemplate>("/print/templates", data);
  updateLabelTemplate = (id: number, data: Partial<LabelTemplatePayload>) => this.put<LabelTemplate>(`/print/templates/${id}`, data);
  setDefaultLabelTemplate = (id: number) => this.post<LabelTemplate>(`/print/templates/${id}/default`);
  deleteLabelTemplate = (id: number) => this.del(`/print/templates/${id}`);
  getExternalSources = (includeInactive = false) => {
    return this.get<ExternalSource[]>(
      this.withQuery("/admin/external-sources", {
        include_inactive: includeInactive ? 1 : undefined,
      }),
    );
  };
  getExternalSource = (id: number) => this.get<ExternalSource>(`/admin/external-sources/${id}`);
  fetchExternalSourceHostKey = (data: { host: string; port: number }) => this.post<ExternalSourceHostKeyInfo>("/admin/external-sources/fetch-host-key", data);
  testExternalSourceConnection = (data: ExternalSourcePayload) => this.post<{ status: string }>("/admin/external-sources/test", data);
  createExternalSource = (data: ExternalSourcePayload) => this.post<ExternalSource>("/admin/external-sources", data);
  updateExternalSource = (id: number, data: ExternalSourcePayload) => this.put<ExternalSource>(`/admin/external-sources/${id}`, data);
  deleteExternalSource = (id: number) => this.del(`/admin/external-sources/${id}`);

  // -- Checkout --
  getCheckoutRequests = () => this.get<CheckoutRequest[]>("/checkout/requests");
  createCheckoutRequest = (data: { realm: string; item_id: number; requested_duration_days?: number; component_item_ids?: number[]; notes?: string }) =>
    this.post<CheckoutRequest>("/checkout/request", data);
  approveRequest = (id: number) => this.put<CheckoutRequest>(`/checkout/requests/${id}/approve`);
  rejectRequest = (id: number) => this.put<CheckoutRequest>(`/checkout/requests/${id}/reject`);
  getActiveCheckouts = () => this.get<ActiveCheckout[]>(`/checkouts/${this.realm}/active`);
  getCheckoutHistory = () => this.get<ActiveCheckout[]>(`/checkouts/${this.realm}/history`);
  getMyOverdueCheckouts = () => this.get<ActiveCheckout[]>("/checkouts/my/overdue");
  getOverdueCheckouts = () => this.get<ActiveCheckout[]>("/checkouts/overdue");
  checkoutItem = (itemId: number, data?: { user_id?: number; notes?: string; due_date?: string; component_item_ids?: number[] }) =>
    this.post<ActiveCheckout>(`/checkout/${this.realm}/${itemId}`, data || {});
  checkinItem = (itemId: number, data?: { checkout_id?: number }) =>
    this.post<{ status: string; checkout_id?: number }>(`/checkin/${this.realm}/${itemId}`, data || {});

  // -- File upload (special handling) --
  uploadAttachment = async (itemId: number, file: File) => {
    return this.postForm<Attachment>(
      `/${this.realm}/items/${itemId}/attachments`,
      buildSingleFileForm(file),
    );
  };
  deleteAttachment = (id: number) => this.del(`/${this.realm}/attachments/${id}`);
  updateAttachment = (id: number, data: Partial<Attachment>) => this.put<Attachment>(`/${this.realm}/attachments/${id}`, data);
  addLinkAttachment = (itemId: number, data: { url: string; filename?: string; description?: string; order?: number }) =>
    this.post<Attachment>(`/${this.realm}/items/${itemId}/attachments/link`, data);
  addExternalSFTPAttachment = (itemId: number, data: { external_source_id: number; external_path: string; filename?: string; description?: string; order?: number; gallery?: boolean }) =>
    this.post<Attachment>(`/${this.realm}/items/${itemId}/attachments/external-sftp`, data);
  getAttachmentExternalSources = () => this.get<ExternalSource[]>(`/${this.realm}/attachments/external-sources`);
  browseAttachmentExternalSource = (sourceId: number, path = "") => {
    return this.get<ExternalSourceBrowseResult>(
      this.withQuery(`/${this.realm}/attachments/external-sources/${sourceId}/browse`, {
        path: path.trim() || undefined,
      }),
    );
  };

  // Property file upload (for file/image property types)
  uploadPropertyFile = async (itemId: number, propertyId: number, file: File) => {
    return this.postForm<{ status: string; value: Record<string, unknown> }>(
      `/${this.realm}/items/${itemId}/properties/${propertyId}/upload`,
      buildSingleFileForm(file),
    );
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
  last_session_seen?: string;
  last_session_online?: boolean;
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
  item_status?: "active" | "reserved" | "for_sale" | "sold";
  is_bundle?: boolean;
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
  salesPlatformId?: number;
  salesPlatformName?: string;
  askingPrice?: number;
  sold_price?: number;
  sold_at?: string;
  componentItemIds?: number[];
  components?: ItemComponent[];
  parentBundle?: ItemComponent | null;
  properties?: Record<string, unknown>;
  properties_display?: Record<string, unknown>;
  checked_out_to?: {
    user_id: number;
    user_name?: string;
    due_date?: string;
    checkout_id: number;
    since?: string;
    users?: Array<{
      user_id: number;
      user_name?: string;
      due_date?: string;
      checkout_id: number;
      since?: string;
      is_overdue?: boolean;
      overdue_days?: number;
    }>;
    checkout_count?: number;
    component_ids?: number[];
    component_names?: string[];
    is_overdue?: boolean;
    overdue_days?: number;
  };
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface ItemComponent {
  id: number;
  name: string;
  item_status?: "active" | "reserved" | "for_sale" | "sold";
  is_bundle?: boolean;
  position?: number;
  parent_item_id?: number | null;
  parent_item_name?: string | null;
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
  created_at?: string;
  updated_at?: string;
}

export interface Attachment {
  id: number;
  item_id: number;
  filename: string;
  file_path: string;
  storage_backend?: "local" | "external_url" | "external_sftp";
  attachment_type: string;
  url?: string;
  download_url?: string;
  external_source_id?: number;
  external_path?: string;
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

export interface AIUsageStats {
  hour: AIUsageStatsPeriod;
  day: AIUsageStatsPeriod;
  week: AIUsageStatsPeriod;
  month: AIUsageStatsPeriod;
  total: AIUsageStatsPeriod;
}

export interface AIUsageStatsPeriod {
  label: "hour" | "day" | "week" | "month" | "total";
  since: string;
  buckets: AIUsageStatsBucket[];
}

export interface AIUsageStatsBucket {
  bucket: string;
  provider: "openai" | "ollama" | string;
  requests: number;
  successful_requests: number;
  failed_requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  web_search_requests: number;
  web_fetch_requests: number;
}

type ItemWire = Item & {
  sales_platform_id?: number;
  sales_platform_name?: string;
  asking_price?: number;
  is_bundle?: boolean;
  component_item_ids?: number[];
  parent_bundle?: ItemComponent | null;
};

function normalizeItem(item: ItemWire): Item {
  const { sales_platform_id, sales_platform_name, asking_price, component_item_ids, parent_bundle, ...rest } = item;
  return {
    ...rest,
    salesPlatformId: item.salesPlatformId ?? sales_platform_id,
    salesPlatformName: item.salesPlatformName ?? sales_platform_name,
    askingPrice: item.askingPrice ?? asking_price,
    componentItemIds: item.componentItemIds ?? component_item_ids ?? [],
    parentBundle: item.parentBundle ?? parent_bundle ?? null,
  };
}

function serializeItemPayload(data: Partial<Item>) {
  const payload: Record<string, unknown> = { ...data };
  payload.sales_platform_id = data.salesPlatformId;
  payload.asking_price = data.askingPrice;
  payload.component_item_ids = data.componentItemIds;
  if (typeof data.is_bundle !== "undefined") {
    payload.is_bundle = Boolean(data.is_bundle);
  }
  delete payload.salesPlatformId;
  delete payload.salesPlatformName;
  delete payload.askingPrice;
  delete payload.componentItemIds;
  delete payload.components;
  delete payload.parentBundle;
  return payload;
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
  is_bundle?: boolean;
  component_item_ids?: number[];
  component_names?: string[];
  bundle_component_item_ids?: number[];
  bundle_component_names?: string[];
  user_id: number;
  user_name?: string;
  status: string;
  requested_duration_days?: number;
  approved_by?: number;
  approved_by_name?: string;
  notes?: string;
  created_at?: string;
  checkout_created_at?: string;
  due_date?: string;
  returned_at?: string;
  duration_days?: number;
  is_overdue?: boolean;
  was_overdue?: boolean;
  overdue_days?: number;
}

export interface ActiveCheckout {
  id: number;
  realm: string;
  item_id: number;
  item_name?: string;
  is_bundle?: boolean;
  component_item_ids?: number[];
  component_names?: string[];
  bundle_component_item_ids?: number[];
  bundle_component_names?: string[];
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
