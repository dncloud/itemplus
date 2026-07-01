import type {
  AIProfile,
  AIProfilePayload,
  AISettings,
  ExternalSource,
  ExternalSourcePayload,
  LabelTemplate,
  LabelTemplatePayload,
} from "@/lib/api";

export type LabelTemplateDraft = LabelTemplatePayload;
export type ExternalSourceDraft = ExternalSourcePayload;

export type AIProfileDraft = AIProfilePayload & {
  has_api_key: boolean;
  api_key_preview?: string;
  chat_prompt_default: string;
  parse_item_prompt_default: string;
  category_property_prompt_default: string;
  property_enhancement_prompt_default: string;
  vendor_prompt_default: string;
};

export type AISettingsDraft = {
  active_profile_id: string;
  profiles: AIProfileDraft[];
};

export function createEmptyTemplateDraft(): LabelTemplateDraft {
  return {
    name: "",
    description: "",
    target: "both",
    dpi: 600,
    width_mm: 20,
    height_mm: 20,
    gap_mm: 3,
    speed: 4,
    density: 8,
    direction: 1,
    reference_x: 0,
    reference_y: 0,
    shift_x: 0,
    shift_y: 0,
    copies_default: 1,
    is_default: false,
    is_active: true,
    tspl_template: `SIZE 20 mm,20 mm
GAP 3.0 mm,0 mm
SPEED 4
DENSITY 8
DIRECTION 1
CODEPAGE 1252
CLS
QRCODE 55,55,H,13,A,0,M2,"{{qr_content}}"
PRINT 1`,
  };
}

export function draftFromTemplate(template: LabelTemplate): LabelTemplateDraft {
  return {
    name: template.name,
    description: template.description || "",
    target: template.target,
    dpi: template.dpi,
    width_mm: template.width_mm,
    height_mm: template.height_mm,
    gap_mm: template.gap_mm,
    speed: template.speed,
    density: template.density,
    direction: template.direction,
    reference_x: template.reference_x,
    reference_y: template.reference_y,
    shift_x: template.shift_x,
    shift_y: template.shift_y,
    copies_default: template.copies_default,
    is_default: template.is_default,
    is_active: template.is_active,
    tspl_template: template.tspl_template,
  };
}

export function createEmptyExternalSourceDraft(): ExternalSourceDraft {
  return {
    name: "",
    description: "",
    source_type: "sftp",
    host: "",
    port: 22,
    username: "",
    auth_type: "password",
    password: "",
    private_key: "",
    known_host_key: "",
    base_path: "/",
    is_active: true,
  };
}

export function draftFromExternalSource(source: ExternalSource): ExternalSourceDraft {
  return {
    name: source.name,
    description: source.description || "",
    source_type: "sftp",
    host: source.host,
    port: source.port,
    username: source.username,
    auth_type: source.auth_type,
    password: "",
    private_key: "",
    known_host_key: source.known_host_key,
    base_path: source.base_path,
    is_active: source.is_active,
  };
}

export function defaultAIBaseURL(provider: AIProfileDraft["provider"]): string {
  if (provider === "ollama") return "http://localhost:11434/v1";
  return "https://api.openai.com/v1";
}

export function defaultAIModel(provider: AIProfileDraft["provider"]): string {
  if (provider === "ollama") return "gpt-oss:20b";
  return "gpt-5-mini";
}

export function isAIKeyOptional(provider: AIProfileDraft["provider"]): boolean {
  return provider === "ollama";
}

export function createEmptyAIProfileDraft(provider: AIProfileDraft["provider"] = "ollama", index = 1): AIProfileDraft {
  return {
    id: `profile-${index}`,
    name: provider === "ollama" ? `Ollama ${index}` : `OpenAI ${index}`,
    provider,
    model: defaultAIModel(provider),
    base_url: defaultAIBaseURL(provider),
    api_key: "",
    enabled: provider === "openai",
    supports_vision: provider === "openai",
    has_api_key: false,
    api_key_preview: "",
    chat_prompt: "",
    parse_item_prompt: "",
    category_property_prompt: "",
    property_enhancement_prompt: "",
    vendor_prompt: "",
    chat_prompt_default: "",
    parse_item_prompt_default: "",
    category_property_prompt_default: "",
    property_enhancement_prompt_default: "",
    vendor_prompt_default: "",
  };
}

export function createEmptyAIDraft(): AISettingsDraft {
  const first = createEmptyAIProfileDraft("openai", 1);
  return {
    active_profile_id: first.id,
    profiles: [first],
  };
}

export function createProviderDraft(
  provider: AIProfileDraft["provider"],
  previous?: AIProfileDraft,
  index = 1,
): AIProfileDraft {
  const next = createEmptyAIProfileDraft(provider, index);
  return {
    ...next,
    id: previous?.id || next.id,
    name: previous?.name || next.name,
    api_key: previous?.api_key || "",
    enabled: previous?.enabled ?? next.enabled,
    supports_vision: provider === "openai" ? true : previous?.provider === provider ? previous.supports_vision : false,
    has_api_key: previous?.has_api_key ?? false,
    api_key_preview: previous?.api_key_preview ?? "",
    chat_prompt: previous?.chat_prompt ?? "",
    parse_item_prompt: previous?.parse_item_prompt ?? "",
    category_property_prompt: previous?.category_property_prompt ?? "",
    property_enhancement_prompt: previous?.property_enhancement_prompt ?? "",
    vendor_prompt: previous?.vendor_prompt ?? "",
    chat_prompt_default: previous?.chat_prompt_default ?? "",
    parse_item_prompt_default: previous?.parse_item_prompt_default ?? "",
    category_property_prompt_default: previous?.category_property_prompt_default ?? "",
    property_enhancement_prompt_default: previous?.property_enhancement_prompt_default ?? "",
    vendor_prompt_default: previous?.vendor_prompt_default ?? "",
  };
}

export function draftFromAIProfile(profile: AIProfile): AIProfileDraft {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    model: profile.model,
    base_url: profile.base_url,
    api_key: "",
    enabled: profile.enabled,
    supports_vision: profile.supports_vision,
    has_api_key: profile.has_api_key,
    api_key_preview: profile.api_key_preview || "",
    chat_prompt: profile.chat_prompt,
    parse_item_prompt: profile.parse_item_prompt,
    category_property_prompt: profile.category_property_prompt,
    property_enhancement_prompt: profile.property_enhancement_prompt,
    vendor_prompt: profile.vendor_prompt,
    chat_prompt_default: profile.chat_prompt_default,
    parse_item_prompt_default: profile.parse_item_prompt_default,
    category_property_prompt_default: profile.category_property_prompt_default,
    property_enhancement_prompt_default: profile.property_enhancement_prompt_default,
    vendor_prompt_default: profile.vendor_prompt_default,
  };
}

export function draftFromAISettings(settings: AISettings): AISettingsDraft {
  const profiles = settings.profiles.map(draftFromAIProfile);
  return {
    active_profile_id: settings.active_profile_id || profiles[0]?.id || "",
    profiles,
  };
}
