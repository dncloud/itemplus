import type { AIParseItemIntentResult, Category, Property } from "@/lib/api";

export function extractPartialAIOutput(message: string) {
  const markers = ["Partial output:", "Partial JSON:"];
  for (const marker of markers) {
    const idx = message.indexOf(marker);
    if (idx >= 0) return message.slice(idx + marker.length).trim();
  }
  return "";
}

export function normalizeChoiceText(value: string) {
  return value.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, " ");
}

export function getPropertyChoices(property: Property): string[] {
  const raw = property.options as unknown;
  if (!raw) return [];
  if (typeof raw === "object" && raw && "choices" in (raw as Record<string, unknown>)) {
    const choices = (raw as Record<string, unknown>).choices;
    return Array.isArray(choices)
      ? choices.filter((choice): choice is string => typeof choice === "string")
      : [];
  }
  return [];
}

export function normalizeToChoice(property: Property, rawValue: string) {
  const choices = getPropertyChoices(property);
  if (choices.length === 0) return rawValue;

  const normalized = normalizeChoiceText(rawValue);
  const exact = choices.find((choice) => normalizeChoiceText(choice) === normalized);
  if (exact) return exact;

  const aliases: Record<string, string> = {
    "echtzeit strategie": "Strategy",
    strategie: "Strategy",
    singleplayer: "Singleplayer",
    einzelspieler: "Singleplayer",
    mehrspieler: "Multiplayer",
    multiplayer: "Multiplayer",
    koop: "Koop",
    "co op": "Koop",
    controller: "Gamepad/Controller",
    gamepad: "Gamepad/Controller",
    directx: "Direct3D",
    "sound blaster kompatibel": "Sound Blaster",
  };
  const aliasTarget = aliases[normalized];
  if (aliasTarget && choices.includes(aliasTarget)) return aliasTarget;

  const partial = choices.find((choice) => {
    const normalizedChoice = normalizeChoiceText(choice);
    return normalizedChoice.includes(normalized) || normalized.includes(normalizedChoice);
  });
  return partial || rawValue;
}

export function normalizeAIPropertyValue(property: Property, rawValue: unknown) {
  if (rawValue == null) return rawValue;

  switch (property.property_type) {
    case "weight": {
      if (typeof rawValue === "object" && rawValue && "value" in (rawValue as Record<string, unknown>)) {
        return rawValue;
      }
      if (typeof rawValue === "number") {
        return { value: rawValue, unit: property.unit || "g" };
      }
      if (typeof rawValue === "string") {
        const match = rawValue.trim().match(/^([\d.,]+)\s*(g|kg|t)$/i);
        if (match) {
          const numeric = Number(match[1].replace(/\./g, "").replace(",", "."));
          if (!Number.isNaN(numeric)) {
            return { value: numeric, unit: match[2].toLowerCase() };
          }
        }
        const numeric = Number(rawValue.replace(/\./g, "").replace(",", "."));
        if (!Number.isNaN(numeric)) {
          return { value: numeric, unit: property.unit || "g" };
        }
      }
      return rawValue;
    }
    case "number":
      if (typeof rawValue === "string" && rawValue.trim() !== "") {
        const numeric = Number(rawValue.replace(/\./g, "").replace(",", "."));
        return Number.isNaN(numeric) ? rawValue : numeric;
      }
      return rawValue;
    case "select":
      return typeof rawValue === "string" ? normalizeToChoice(property, rawValue) : rawValue;
    case "multiselect": {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      return values
        .filter((value): value is string => typeof value === "string" && value.trim() !== "")
        .map((value) => normalizeToChoice(property, value));
    }
    case "age_rating":
      if (typeof rawValue === "string") {
        const normalized = normalizeChoiceText(rawValue);
        const ratingAliases: Record<string, string> = {
          "usk 0": "usk0",
          "usk 6": "usk6",
          "usk 12": "usk12",
          "usk 16": "usk16",
          "usk 18": "usk18",
          "fsk 0": "fsk0",
          "fsk 6": "fsk6",
          "fsk 12": "fsk12",
          "fsk 16": "fsk16",
          "fsk 18": "fsk18",
          "pegi 3": "pegi3",
          "pegi 4": "pegi4",
          "pegi 6": "pegi6",
          "pegi 7": "pegi7",
          "pegi 11": "pegi11",
          "pegi 12": "pegi12",
          "pegi 15": "pegi15",
          "pegi 16": "pegi16",
          "pegi 18": "pegi18",
        };
        return ratingAliases[normalized] ? [ratingAliases[normalized]] : rawValue;
      }
      return rawValue;
    case "condition":
      if (typeof rawValue === "string") {
        const normalized = normalizeChoiceText(rawValue);
        const conditionAliases: Record<string, string> = {
          neu: "new",
          new: "new",
          "wie neu": "like_new",
          "sehr gut": "very_good",
          gut: "good",
          akzeptabel: "acceptable",
          schlecht: "poor",
          defekt: "defective",
        };
        return conditionAliases[normalized] || rawValue;
      }
      return rawValue;
    default:
      return rawValue;
  }
}

export function isWeakAIIdentification(result: AIParseItemIntentResult) {
  const fieldName = typeof result.fields?.name === "string" ? result.fields.name.trim().toLowerCase() : "";
  const description = typeof result.fields?.description === "string" ? result.fields.description.trim().toLowerCase() : "";
  const propertiesCount = Object.keys(result.properties || {}).length;
  const questionsCount = result.questions?.length || 0;
  const notesText = (result.notes || []).join(" ").toLowerCase();
  const categoryReason = (result.category_proposal?.reason || "").toLowerCase();

  const hasUnknownName =
    fieldName.startsWith("unbekannt") ||
    fieldName.startsWith("unknown") ||
    fieldName.includes("unbekanntes produkt") ||
    fieldName.includes("unknown product");

  const hasLookupFailureSignals =
    description.includes("kein belastbar") ||
    description.includes("kein eindeutig") ||
    description.includes("asin") ||
    description.includes("kein standardisierter ean") ||
    notesText.includes("kein belastbar") ||
    notesText.includes("kein verläss") ||
    notesText.includes("asin") ||
    categoryReason.includes("asin") ||
    categoryReason.includes("kein ean") ||
    categoryReason.includes("kein upc");

  return (result.confidence ?? 0) < 0.5 && propertiesCount === 0 && (hasUnknownName || hasLookupFailureSignals || questionsCount > 0);
}

export function shouldSuppressWeakCategorySuggestion(
  result: AIParseItemIntentResult,
  barcodeCode: string | undefined,
  currentName: string | undefined,
  currentCategoryID: number | undefined,
) {
  const isBarcodeOnlyLookup = !!barcodeCode && !currentName?.trim() && typeof currentCategoryID !== "number";
  if (!isBarcodeOnlyLookup) return false;

  const fieldName = typeof result.fields?.name === "string" ? result.fields.name.trim().toLowerCase() : "";
  const looksGenericName =
    fieldName === "" ||
    fieldName.startsWith("unbekannt") ||
    fieldName.startsWith("unknown") ||
    fieldName.includes("produkt mit code") ||
    fieldName.includes("product with code");

  const hasLittleStructuredData = Object.keys(result.properties || {}).length < 2;
  const lowConfidence = (result.confidence ?? 0) < 0.78;

  return lowConfidence || looksGenericName || hasLittleStructuredData;
}

export function collectAISuggestedProperties(
  result: AIParseItemIntentResult,
  allProperties: Property[],
  nextCategoryId: number | undefined,
) {
  const nextSuggestedProps: Record<string, unknown> = {};
  if (result.properties && Object.keys(result.properties).length > 0) {
    const relevantProperties = allProperties.filter((property) => !nextCategoryId || property.category_id === nextCategoryId);
    for (const [key, value] of Object.entries(result.properties)) {
      const byId = relevantProperties.find((property) => String(property.id) === key);
      const byName = relevantProperties.find((property) => property.name.trim().toLowerCase() === key.trim().toLowerCase());
      const match = byId || byName;
      if (match) nextSuggestedProps[String(match.id)] = normalizeAIPropertyValue(match, value);
    }
  }
  return nextSuggestedProps;
}

export function resolveSuggestedCategoryId(
  result: AIParseItemIntentResult,
  categories: Category[],
  barcodeCode: string | undefined,
  currentName: string | undefined,
  currentCategoryID: number | undefined,
) {
  return result.suggested_category_id &&
    !shouldSuppressWeakCategorySuggestion(result, barcodeCode, currentName, currentCategoryID) &&
    categories.some((category) => category.id === result.suggested_category_id)
    ? result.suggested_category_id
    : undefined;
}

export function extractJSONStringValues(source: string, key: string) {
  if (!source) return [];
  const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "g");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    try {
      values.push(JSON.parse(`"${match[1]}"`));
    } catch {
      values.push(match[1]);
    }
  }
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}

export function extractJSONArrayStrings(source: string, key: string) {
  if (!source) return [];
  const pattern = new RegExp(`"${key}"\\s*:\\s*\\[((?:.|\\n|\\r)*?)\\]`, "g");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const inner = match[1];
    const stringMatches = inner.match(/"((?:\\.|[^"\\])*)"/g) || [];
    for (const raw of stringMatches) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && !values.includes(parsed)) values.push(parsed);
      } catch {
        // ignore malformed fragments
      }
    }
  }
  return values;
}
