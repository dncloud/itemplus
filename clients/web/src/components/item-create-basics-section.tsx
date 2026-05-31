"use client";

import type { Category, Item, Location } from "@/lib/api";
import { MarkdownEditor } from "@/components/markdown";
import { Field, ModalSection, SuggestionRow, TWPSelect } from "@/components/item-create-ui";

export function ItemCreateBasicsSection({
  t,
  editItem,
  setEditItem,
  aiSuggestedItem,
  suggestedCategoryName,
  valuesEqual,
  applySuggestedField,
  categories,
  locations,
  clearPropValues,
}: {
  t: (key: string) => string;
  editItem: Partial<Item>;
  setEditItem: (value: Partial<Item>) => void;
  aiSuggestedItem: Partial<Item>;
  suggestedCategoryName: string;
  valuesEqual: (left: unknown, right: unknown) => boolean;
  applySuggestedField: <K extends keyof Item>(field: K) => void;
  categories: Category[];
  locations: Location[];
  clearPropValues: () => void;
}) {
  return (
    <ModalSection
      title={t("items.modalBasicsTitle")}
      description={t("items.modalBasicsDescription")}
      noTopBorder
    >
      <div className="w-full space-y-6">
        <div>
          <Field
            label={t("items.name")}
            value={editItem.name || ""}
            onChange={(v) => setEditItem({ ...editItem, name: v })}
          />
          {typeof aiSuggestedItem.name === "string" &&
          aiSuggestedItem.name.trim() &&
          !valuesEqual(editItem.name, aiSuggestedItem.name) ? (
            <SuggestionRow
              value={aiSuggestedItem.name}
              onApply={() => applySuggestedField("name")}
              label={t("common.apply")}
            />
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("items.description")}</label>
          <MarkdownEditor
            value={editItem.description || ""}
            onChange={(v) => setEditItem({ ...editItem, description: v })}
            rows={3}
          />
          {typeof aiSuggestedItem.description === "string" &&
          !valuesEqual(editItem.description, aiSuggestedItem.description) ? (
            <SuggestionRow
              value={aiSuggestedItem.description}
              onApply={() => applySuggestedField("description")}
              label={t("common.apply")}
              multiline
            />
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <TWPSelect
              label={t("items.category")}
              value={editItem.category_id}
              onChange={(v) => {
                setEditItem({ ...editItem, category_id: v });
                if (!v) clearPropValues();
              }}
              options={categories.map((c) => ({ id: c.id, name: c.name }))}
            />
            {typeof aiSuggestedItem.category_id === "number" &&
            suggestedCategoryName &&
            !valuesEqual(editItem.category_id, aiSuggestedItem.category_id) ? (
              <SuggestionRow
                value={suggestedCategoryName}
                onApply={() => applySuggestedField("category_id")}
                label={t("common.apply")}
              />
            ) : null}
          </div>
          <TWPSelect
            label={t("items.location")}
            value={editItem.location_id}
            onChange={(v) => setEditItem({ ...editItem, location_id: v })}
            options={locations.map((l) => ({ id: l.id, name: l.name }))}
          />
        </div>
      </div>
    </ModalSection>
  );
}
