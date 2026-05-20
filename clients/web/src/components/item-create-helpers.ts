import type { Item, Property } from "@/lib/api";
import {
  extractJSONArrayStrings,
  extractJSONStringValues,
} from "@/components/item-create-ai-utils";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function collectPendingPropertyFiles(propValues: Record<string, unknown>) {
  const cleanProps: Record<string, unknown> = {};
  const pendingFiles: { propId: string; file: File }[] = [];

  for (const [key, value] of Object.entries(propValues)) {
    if (value && typeof value === "object" && "_pendingFile" in (value as Record<string, unknown>)) {
      const record = value as Record<string, unknown>;
      pendingFiles.push({ propId: key, file: record._pendingFile as File });
      continue;
    }
    cleanProps[key] = value;
  }

  return { cleanProps, pendingFiles };
}

export function resolvePhotoLookupPrompt(args: {
  itemName?: string | null;
  categoryId?: number;
  barcodeCode?: string | null;
  buildAIAssistPrompt: (extraContext?: string) => string;
  buildBarcodeLookupPrompt: (code: string) => string;
}) {
  const { itemName, categoryId, barcodeCode, buildAIAssistPrompt, buildBarcodeLookupPrompt } = args;

  if (itemName?.trim() && typeof categoryId === "number") {
    return buildAIAssistPrompt(
      "Use the attached photo to identify the item more precisely and fill matching properties.",
    );
  }

  return `${buildBarcodeLookupPrompt(barcodeCode || "")}
Use the attached photo to identify the item more precisely.`;
}

export function countVisibleSuggestedFields(
  aiSuggestedItem: Partial<Item>,
  editItem: Partial<Item>,
  valuesEqual: (left: unknown, right: unknown) => boolean,
) {
  return (Object.keys(aiSuggestedItem) as Array<keyof Item>).filter(
    (field) =>
      typeof aiSuggestedItem[field] !== "undefined" &&
      !valuesEqual(editItem[field], aiSuggestedItem[field]),
  ).length;
}

export function countVisibleSuggestedProperties(
  aiSuggestedPropValues: Record<string, unknown>,
  propValues: Record<string, unknown>,
  valuesEqual: (left: unknown, right: unknown) => boolean,
) {
  return Object.entries(aiSuggestedPropValues).filter(
    ([propertyId, value]) => !valuesEqual(propValues[propertyId], value),
  ).length;
}

export function formatItemSuggestionValue(value: unknown, property?: Property) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    if (property?.property_type === "weight" && "value" in (value as Record<string, unknown>)) {
      const record = value as Record<string, unknown>;
      return `${record.value}${record.unit ? ` ${record.unit}` : ""}`;
    }
    return JSON.stringify(value);
  }
  if (typeof value === "number" && property?.unit) return `${value} ${property.unit}`;
  return String(value);
}

export function buildAIStatusDetails(aiAssistStatus: string | null, t: TranslateFn) {
  if (!aiAssistStatus) return null;

  const normalized = aiAssistStatus.toLowerCase();
  const isSuccess =
    aiAssistStatus === t("items.aiApplied") ||
    aiAssistStatus === t("items.aiSuggestionsReady");
  if (isSuccess) return null;

  const details: { title: string; body?: string; actionLabel?: string } = {
    title: t("items.aiStatusTitle"),
    body: aiAssistStatus,
  };

  if (aiAssistStatus === t("items.aiStatusNoProductFound")) {
    details.title = t("items.aiStatusNoProductFound");
    details.body = "";
    return details;
  }

  if (normalized.includes("could not parse model json") || normalized.includes("model did not return")) {
    details.title = t("items.aiStatusNoProductFound");
    details.body = "";
    details.actionLabel = t("items.aiStatusOpenDebug");
  }

  return details;
}

export function buildAIErrorInsights(aiLiveText: string, aiAssistStatus: string | null) {
  const source = [aiLiveText, aiAssistStatus].filter(Boolean).join("\n");
  if (!source) return null;

  const reasons = extractJSONStringValues(source, "reason");
  const descriptions = extractJSONStringValues(source, "description");
  const questions = extractJSONArrayStrings(source, "questions");
  const notes = extractJSONArrayStrings(source, "notes");

  if (reasons.length === 0 && descriptions.length === 0 && questions.length === 0 && notes.length === 0) {
    return null;
  }

  return {
    reason: reasons[0] || "",
    description: descriptions[0] || "",
    questions: questions.slice(0, 5),
    notes: notes.slice(0, 3),
  };
}
