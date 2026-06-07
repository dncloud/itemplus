import type {
  AISettings,
  AISettingsPayload,
  ExternalSource,
  ExternalSourcePayload,
  LabelTemplate,
  LabelTemplatePayload,
} from "@/lib/api";

export type LabelTemplateDraft = LabelTemplatePayload;
export type ExternalSourceDraft = ExternalSourcePayload;
export type AISettingsDraft = AISettingsPayload & {
  has_api_key: boolean;
  parse_item_prompt_default: string;
  category_property_prompt_default: string;
  property_enhancement_prompt_default: string;
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

export function createEmptyAIDraft(): AISettingsDraft {
  return {
    provider: "ollama",
    model: "llama3.2",
    base_url: "http://localhost:11434/v1",
    api_key: "",
    enabled: false,
    has_api_key: false,
    parse_item_prompt: "",
    category_property_prompt: "",
    property_enhancement_prompt: "",
    parse_item_prompt_default: "",
    category_property_prompt_default: "",
    property_enhancement_prompt_default: "",
  };
}

export function defaultAIBaseURL(provider: AISettingsDraft["provider"]): string {
  if (provider === "ollama") return "http://localhost:11434/v1";
  return "https://api.openai.com/v1";
}

export function defaultAIModel(provider: AISettingsDraft["provider"]): string {
  if (provider === "ollama") return "llama3.2";
  if (provider === "openai_compatible") return "";
  return "gpt-5-mini";
}

export function isAIKeyOptional(provider: AISettingsDraft["provider"]): boolean {
  return provider === "ollama";
}

export function createProviderDraft(
  provider: AISettingsDraft["provider"],
  previous?: AISettingsDraft,
): AISettingsDraft {
  return {
    provider,
    model: defaultAIModel(provider),
    base_url: defaultAIBaseURL(provider),
    api_key: previous?.api_key || "",
    enabled: previous?.enabled ?? false,
    has_api_key: previous?.has_api_key ?? false,
    parse_item_prompt: previous?.parse_item_prompt ?? "",
    category_property_prompt: previous?.category_property_prompt ?? "",
    property_enhancement_prompt: previous?.property_enhancement_prompt ?? "",
    parse_item_prompt_default: previous?.parse_item_prompt_default ?? "",
    category_property_prompt_default: previous?.category_property_prompt_default ?? "",
    property_enhancement_prompt_default: previous?.property_enhancement_prompt_default ?? "",
  };
}

export function draftFromAISettings(settings: AISettings): AISettingsDraft {
  return {
    provider: settings.provider,
    model: settings.model,
    base_url: settings.base_url,
    api_key: "",
    enabled: settings.enabled,
    has_api_key: settings.has_api_key,
    parse_item_prompt: settings.parse_item_prompt,
    category_property_prompt: settings.category_property_prompt,
    property_enhancement_prompt: settings.property_enhancement_prompt,
    parse_item_prompt_default: settings.parse_item_prompt_default,
    category_property_prompt_default: settings.category_property_prompt_default,
    property_enhancement_prompt_default: settings.property_enhancement_prompt_default,
  };
}
