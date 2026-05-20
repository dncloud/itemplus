import type { AIParseItemIntentResult, Category, Item, Property } from "@/lib/api";
import {
  buildAIErrorInsights,
  buildAIStatusDetails,
  countVisibleSuggestedFields,
  countVisibleSuggestedProperties,
} from "@/components/item-create-helpers";
import { collectAISuggestedProperties, isWeakAIIdentification, resolveSuggestedCategoryId } from "@/components/item-create-ai-utils";

export function deriveAISuggestions(params: {
  result: AIParseItemIntentResult;
  categories: Category[];
  allProperties: Property[];
  barcodeCode?: string;
  itemName?: string;
  itemCategoryId?: number;
  realm: "archive" | "collection";
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const { result, categories, allProperties, barcodeCode, itemName, itemCategoryId, realm, t } = params;

  if (isWeakAIIdentification(result)) {
    return {
      suggestedItem: {},
      suggestedPropValues: {},
      status: t("items.aiStatusNoProductFound"),
    };
  }

  const nextCategoryId = resolveSuggestedCategoryId(
    result,
    categories,
    barcodeCode,
    itemName,
    itemCategoryId,
  );

  const fields = result.fields || {};
  const suggestedItem: Partial<Item> = {};
  if (typeof fields.name === "string" && fields.name.trim()) suggestedItem.name = fields.name.trim();
  if (typeof fields.description === "string") suggestedItem.description = fields.description;
  if (typeof fields.quantity === "number") suggestedItem.quantity = fields.quantity;
  if (typeof fields.purchase_price === "number") suggestedItem.purchase_price = fields.purchase_price;
  if (typeof fields.purchase_currency === "string" && fields.purchase_currency.trim() !== "") {
    suggestedItem.purchase_currency = fields.purchase_currency;
  }
  if (typeof nextCategoryId === "number") suggestedItem.category_id = nextCategoryId;

  const suggestedPropValues = collectAISuggestedProperties(result, allProperties, nextCategoryId);
  const status =
    result.suggested_realm && result.suggested_realm !== realm
      ? t("items.aiRealmMismatch", {
          realm: result.suggested_realm === "archive" ? t("realm.archive") : t("realm.collection"),
        })
      : t("items.aiSuggestionsReady");

  return { suggestedItem, suggestedPropValues, status };
}

export function buildAIViewState(params: {
  aiSuggestedItem: Partial<Item>;
  editItem: Partial<Item>;
  aiSuggestedPropValues: Record<string, unknown>;
  propValues: Record<string, unknown>;
  aiAssistStatus: string | null;
  aiLiveText: string;
  categories: Category[];
  valuesEqual: (left: unknown, right: unknown) => boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const {
    aiSuggestedItem,
    editItem,
    aiSuggestedPropValues,
    propValues,
    aiAssistStatus,
    aiLiveText,
    categories,
    valuesEqual,
    t,
  } = params;

  const suggestedCategoryName =
    typeof aiSuggestedItem.category_id === "number"
      ? categories.find((category) => category.id === aiSuggestedItem.category_id)?.name || ""
      : "";

  const visibleSuggestedItemCount = countVisibleSuggestedFields(aiSuggestedItem, editItem, valuesEqual);
  const visibleSuggestedPropCount = countVisibleSuggestedProperties(aiSuggestedPropValues, propValues, valuesEqual);

  return {
    suggestedCategoryName,
    hasVisibleSuggestions: visibleSuggestedItemCount > 0 || visibleSuggestedPropCount > 0,
    aiStatusDetails: buildAIStatusDetails(aiAssistStatus, t),
    aiErrorInsights: buildAIErrorInsights(aiLiveText, aiAssistStatus),
  };
}
