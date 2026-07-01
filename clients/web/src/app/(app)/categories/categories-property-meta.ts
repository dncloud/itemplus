"use client";

export const TYPES_WITH_UNIT = new Set(["number", "dimensions", "weight"]);
export const TYPES_WITH_CHOICES = new Set(["select", "multiselect"]);

export function getPropertyTypes(t: (key: string) => string): { value: string; label: string }[] {
  return [
    { value: "text", label: t("categories.types.text") },
    { value: "textblock", label: t("categories.types.textblock") },
    { value: "number", label: t("categories.types.number") },
    { value: "boolean", label: t("categories.types.boolean") },
    { value: "date", label: t("categories.types.date") },
    { value: "time", label: t("categories.types.time") },
    { value: "select", label: t("categories.types.select") },
    { value: "multiselect", label: t("categories.types.multiselect") },
    { value: "rating", label: t("categories.types.rating") },
    { value: "dimensions", label: t("categories.types.dimensions") },
    { value: "age_rating", label: t("categories.types.ageRating") },
    { value: "condition", label: t("categories.types.condition") },
    { value: "priority", label: t("categories.types.priority") },
    { value: "weight", label: t("categories.types.weight") },
  ];
}
