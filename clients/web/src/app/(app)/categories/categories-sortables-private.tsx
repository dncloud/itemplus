"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";

export function SortableChoice({
  id,
  value,
  onChange,
  onRemove,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  onRemove: () => void;
  placeholder: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-1.5">
      <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-3.5 w-3.5 text-gray-400" />
      </button>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
      />
      <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-500">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
