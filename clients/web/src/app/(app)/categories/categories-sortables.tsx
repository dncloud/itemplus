"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, Pencil } from "lucide-react";
import clsx from "clsx";
import type { Category, Property } from "@/lib/api";
import { DragLines, ExpandMarker, RowMenu, dragHandleClass, iconButtonClass } from "@/components/ui/list-controls";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const chipClass = "shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-white/10 dark:text-gray-400";

const WIDTHS = ["third", "half", "full"] as const;
type Width = (typeof WIDTHS)[number];

// The width of a property, changeable right in its row.
function WidthPicker({ name, value, onChange, t }: { name: string; value: Width; onChange: (width: Width) => void; t: Translate }) {
  return (
    <span role="radiogroup" aria-label={`${name}: ${t("categories.displayWidth")}`} title={t("categories.displayWidth")} className="isolate inline-flex shrink-0 rounded-md">
      {WIDTHS.map((width, index) => (
        <button
          key={width}
          type="button"
          role="radio"
          aria-checked={value === width}
          onClick={() => { if (value !== width) onChange(width); }}
          className={clsx(
            "relative inline-flex items-center px-2 py-0.5 text-xs font-medium inset-ring inset-ring-gray-300 focus:z-10 dark:inset-ring-gray-700",
            index === 0 && "rounded-l-md",
            index > 0 && "-ml-px",
            index === WIDTHS.length - 1 && "rounded-r-md",
            value === width
              ? "z-10 bg-indigo-600 text-white inset-ring-indigo-600 dark:bg-indigo-500 dark:inset-ring-indigo-500"
              : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200",
          )}
        >
          {t(`categories.width.${width}`)}
        </button>
      ))}
    </span>
  );
}

// One property in the list under its category: a single line that says what
// kind of field it is, how wide it is shown and whether it is required.
export function SortableProperty({
  property: prop,
  propertyTypeLabel,
  onEdit,
  onDelete,
  onToggleVisibility,
  onSetWidth,
  canReorder = true,
  canEdit = true,
  canDelete = true,
  pendingDelete = false,
  canToggleVisibility = true,
  t,
  children,
}: {
  property: Property;
  onSetWidth?: (width: Width) => void;
  propertyTypeLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  canReorder?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  pendingDelete?: boolean;
  canToggleVisibility?: boolean;
  t: Translate;
  children?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: prop.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const visibilityLabel = prop.show_in_list ? t("categories.shownInList") : t("categories.hiddenInList");

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg">
      <div className="flex items-center gap-2 py-2">
        {canReorder ? (
          <button
            {...attributes}
            {...listeners}
            title={t("categories.move")}
            aria-label={t("categories.move")}
            className={dragHandleClass}
          >
            <DragLines className="h-4 w-4" />
          </button>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{prop.name}</span>
          {prop.unit ? <span className="text-xs text-gray-400">({prop.unit})</span> : null}
          <span className={chipClass}>{propertyTypeLabel}</span>
          {canEdit && onSetWidth ? null : <span className={chipClass}>{t(`categories.width.${prop.display_width || "third"}`)}</span>}
          {prop.required ? <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">{t("categories.requiredField")}</span> : null}
        </div>
        {canEdit && onSetWidth ? <WidthPicker name={prop.name} value={prop.display_width || "third"} onChange={onSetWidth} t={t} /> : null}
        {canToggleVisibility ? (
          <button type="button" onClick={onToggleVisibility} className={iconButtonClass} title={visibilityLabel} aria-label={visibilityLabel} aria-pressed={!!prop.show_in_list}>
            {prop.show_in_list ? <Eye className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" onClick={onEdit} className={iconButtonClass} title={t("common.edit")} aria-label={t("common.edit")}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {canDelete ? <RowMenu t={t} pending={pendingDelete} onDelete={onDelete} small /> : null}
      </div>
      {children}
    </div>
  );
}

export function SortableCategory({
  category,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  canReorder = true,
  canEdit = true,
  canDelete = true,
  pendingDelete = false,
  t,
  children,
}: {
  category: Category;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canReorder?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  pendingDelete?: boolean;
  t: Translate;
  children?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const itemCount = category.item_count ?? 0;
  // What a category is for: how many items use it and how many fields it gives them.
  const summary = [
    itemCount === 1 ? t("categories.itemCountOne") : t("categories.itemCount", { count: itemCount }),
    typeof category.property_count !== "number" ? "" : category.property_count === 1 ? t("categories.propertyCountOne") : t("categories.propertyCount", { count: category.property_count }),
  ].filter(Boolean).join(" · ");

  return (
    <div ref={setNodeRef} style={style} className="overflow-hidden">
      <div className={clsx("relative flex items-center gap-y-4 px-4 py-4 sm:px-6", isExpanded ? "bg-gray-50 dark:bg-white/5" : "hover:bg-gray-50 dark:hover:bg-white/2.5")}>
        {canReorder ? (
          <button
            {...attributes}
            {...listeners}
            title={t("categories.move")}
            aria-label={t("categories.move")}
            className={clsx(dragHandleClass, "mr-2")}
          >
            <DragLines className="h-4 w-4" />
          </button>
        ) : null}
        {/* The whole name area opens the category; the framed arrow in front says so. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          title={isExpanded ? t("categories.collapse") : t("categories.expand")}
          className="group flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ExpandMarker open={isExpanded} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm/6 font-semibold text-gray-900 dark:text-white">
              {category.color ? <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} /> : null}
              {category.name}
            </span>
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{summary}</span>
          </span>
        </button>
        {canEdit || canDelete ? (
          <div className="flex gap-1">
            {canEdit ? (
              <button type="button" onClick={onEdit} title={t("common.edit")} aria-label={t("common.edit")} className={iconButtonClass}>
                <Pencil className="h-4 w-4" />
              </button>
            ) : null}
            {canDelete ? (
              <RowMenu
                t={t}
                pending={pendingDelete}
                onDelete={onDelete}
                blockedReason={itemCount === 1 ? t("categories.inUseOne") : itemCount > 1 ? t("categories.inUse", { count: itemCount }) : undefined}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
