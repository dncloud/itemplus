"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, Box, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import type { Category, Property } from "@/lib/api";

export function SortableProperty({
  property: prop,
  propertyTypeLabel,
  fmtDateTime,
  onEdit,
  onDelete,
  onToggleVisibility,
  canReorder = true,
  canEdit = true,
  canDelete = true,
  pendingDelete = false,
  canToggleVisibility = true,
  t,
  children,
}: {
  property: Property;
  propertyTypeLabel: string;
  fmtDateTime: (v: string) => string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  canReorder?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  pendingDelete?: boolean;
  canToggleVisibility?: boolean;
  t: (k: string) => string;
  children?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: prop.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg">
      <div className="flex items-center gap-2 px-3 py-2">
        {canReorder ? (
          <button {...attributes} {...listeners} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing">
            <GripVertical className="h-3.5 w-3.5 text-gray-400" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{prop.name}</span>
            {prop.unit ? <span className="text-xs text-gray-400">({prop.unit})</span> : null}
            <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-400 dark:bg-gray-700">{propertyTypeLabel}</span>
            {prop.required ? <span className="shrink-0 text-xs text-red-400">*</span> : null}
            {prop.display_width && prop.display_width !== "third" ? (
              <span className="shrink-0 rounded bg-gray-200 px-1 py-0.5 text-[10px] text-gray-400 dark:bg-gray-700">
                {prop.display_width === "full" ? t("categories.width.full") : t("categories.width.half")}
              </span>
            ) : null}
          </div>
          {prop.created_at ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("common.created")} {fmtDateTime(prop.created_at)}
              <> · {t("common.updated")} {fmtDateTime(prop.updated_at || prop.created_at)}</>
            </p>
          ) : null}
        </div>
        {canToggleVisibility ? (
          <button onClick={onToggleVisibility} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/10" title={prop.show_in_list ? "👁" : "👁‍🗨"}>
            {prop.show_in_list ? <Eye className="h-3.5 w-3.5 text-blue-500" /> : <EyeOff className="h-3.5 w-3.5 text-gray-300" />}
          </button>
        ) : null}
        {canEdit ? (
          <button onClick={onEdit} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/10">
            <Pencil className="h-3.5 w-3.5 text-gray-400" />
          </button>
        ) : null}
        {canDelete ? (
          <button
            onClick={onDelete}
            disabled={pendingDelete}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:bg-red-900/20"
          >
            {pendingDelete ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
            )}
          </button>
        ) : null}
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
  onShowItems,
  canReorder = true,
  canEdit = true,
  canDelete = true,
  pendingDelete = false,
  canShowItems = true,
  fmtDateTime,
  t,
  children,
}: {
  category: Category;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowItems: () => void;
  canReorder?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  pendingDelete?: boolean;
  canShowItems?: boolean;
  fmtDateTime: (v: string) => string;
  t: (k: string) => string;
  children?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="overflow-hidden">
      <div className="relative flex items-center gap-y-4 px-4 py-5 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/2.5">
        {canReorder ? (
          <button {...attributes} {...listeners} className="mr-2 inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </button>
        ) : null}
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <div className="min-w-0">
            <span className="text-sm/6 font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              {category.color ? <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: category.color }} /> : null}
              {category.name}
            </span>
            {category.created_at ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("common.created")} {fmtDateTime(category.created_at)}
                <> · {t("common.updated")} {fmtDateTime(category.updated_at || category.created_at)}</>
              </p>
            ) : null}
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
        </button>
        {canShowItems || canEdit || canDelete ? (
          <div className="flex gap-1">
            {canShowItems ? (
              <button onClick={onShowItems} title="Items" className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10"><Box className="h-4 w-4 text-gray-400" /></button>
            ) : null}
            {canEdit ? (
              <button onClick={onEdit} className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/10"><Pencil className="h-4 w-4 text-gray-400" /></button>
            ) : null}
            {canDelete ? (
              <button
                onClick={onDelete}
                disabled={pendingDelete}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:bg-red-900/20"
              >
                {pendingDelete ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                ) : (
                  <Trash2 className="h-4 w-4 text-red-400" />
                )}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
