"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Property } from "@/lib/api";

type Translate = (key: string, vars?: Record<string, string | number>) => string;
type Width = "third" | "half" | "full";

const nextWidth: Record<Width, Width> = { third: "half", half: "full", full: "third" };
const widthOf = (prop: Property): Width => (prop.display_width === "half" || prop.display_width === "full" ? prop.display_width : "third");

function PreviewBlock({ prop, editable, onCycleWidth, t }: {
  prop: Property;
  editable: boolean;
  onCycleWidth: () => void;
  t: Translate;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: prop.id, disabled: !editable });
  const width = widthOf(prop);
  const widthLabel = t(`categories.width.${width}`);

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={editable ? onCycleWidth : undefined}
      title={editable ? t("categories.layoutChangeWidth", { name: prop.name, width: widthLabel }) : undefined}
      className={clsx(
        "flex min-w-0 items-center justify-between gap-2 rounded-md bg-white px-2.5 py-2 text-left outline-1 -outline-offset-1 outline-gray-300 dark:bg-white/5 dark:outline-white/10",
        width === "full" ? "col-span-6" : width === "half" ? "col-span-6 sm:col-span-3" : "col-span-6 sm:col-span-2",
        editable ? "cursor-grab hover:outline-indigo-500 active:cursor-grabbing dark:hover:outline-indigo-400" : "cursor-default",
        isDragging && "relative z-10 shadow-lg",
      )}
    >
      <span className="truncate text-xs font-medium text-gray-900 dark:text-white">{prop.name}</span>
      <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{widthLabel}</span>
    </button>
  );
}

// The properties of a category as they are laid out on an item's page: same
// six-column grid, same widths. Dragging reorders, a click changes the width.
export function CategoryLayoutPreview({ properties, editable, onDragEnd, onSetWidth, t }: {
  properties: Property[];
  editable: boolean;
  onDragEnd: (event: DragEndEvent) => Promise<void>;
  onSetWidth: (prop: Property, width: Width) => Promise<void>;
  t: Translate;
}) {
  // A drag only starts after a few pixels, so a plain click still reaches the block.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  if (properties.length < 2) return null;

  return (
    <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-white/2.5">
      <p className="text-xs font-semibold text-gray-900 dark:text-white">{t("categories.layoutPreview")}</p>
      {editable ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t("categories.layoutPreviewHint")}</p> : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => { void onDragEnd(event); }}>
        <SortableContext items={properties.map((prop) => prop.id)} strategy={rectSortingStrategy}>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {properties.map((prop) => (
              <PreviewBlock
                key={prop.id}
                prop={prop}
                editable={editable}
                onCycleWidth={() => { void onSetWidth(prop, nextWidth[widthOf(prop)]); }}
                t={t}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
