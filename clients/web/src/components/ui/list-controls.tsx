"use client";

import type { ReactNode } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronRight, Ellipsis, Menu as DragLines, Sparkles, Trash2 } from "lucide-react";
import clsx from "clsx";

// Shared pieces of the sortable lists (categories, locations, master data)
// and of the forms that open inside them, so the three pages look the same.

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const iconButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 dark:border-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200";

// The drag handle is three quiet lines without a frame: it only shows up
// properly when the pointer is on it.
export const dragHandleClass =
  "inline-flex cursor-grab items-center justify-center rounded-md p-1 text-gray-300 transition hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-indigo-600 active:cursor-grabbing dark:text-gray-600 dark:hover:text-gray-300 dark:focus-visible:outline-indigo-500";

export { DragLines };

/** The main action of a page: filled indigo, icon plus text, top right. */
export const pageActionClass =
  "inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500";

export const formCardClass =
  "rounded-lg bg-gray-50 p-4 outline-1 -outline-offset-1 outline-gray-200 sm:p-5 dark:bg-white/2.5 dark:outline-white/10";
export const cancelButtonClass =
  "rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20";
export const saveButtonClass =
  "rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500";

// Deleting sits behind a menu, so it is never the loudest thing in a row.
// When it would be refused anyway, the menu says why instead of offering it.
export function RowMenu({ t, pending, onDelete, blockedReason, small = false }: {
  t: Translate;
  pending: boolean;
  onDelete: () => void;
  blockedReason?: string;
  small?: boolean;
}) {
  const iconSize = small ? "h-3.5 w-3.5" : "h-4 w-4";
  if (pending) {
    return (
      <span className={iconButtonClass}>
        <span className={clsx(iconSize, "block animate-spin rounded-full border-2 border-red-400 border-t-transparent")} />
      </span>
    );
  }
  return (
    <Menu as="div" className="relative">
      <MenuButton className={iconButtonClass} title={t("items.moreActions")} aria-label={t("items.moreActions")}>
        <Ellipsis className={iconSize} />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        transition
        className="z-50 mt-1 w-56 origin-top-right rounded-md bg-white py-1 shadow-lg outline-1 outline-black/5 transition data-[closed]:scale-95 data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
      >
        {blockedReason ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </span>
            <span className="mt-1 block text-xs">{blockedReason}</span>
          </div>
        ) : (
          <MenuItem>
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 data-[focus]:bg-red-50 data-[focus]:outline-hidden dark:text-red-400 dark:data-[focus]:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </button>
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  );
}

/** The framed arrow in front of a row that can be opened; filled while open. */
export function ExpandMarker({ open, small = false }: { open: boolean; small?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-md transition",
        small ? "size-6" : "size-7",
        open
          ? "bg-indigo-600 text-white dark:bg-indigo-500"
          : "text-gray-500 inset-ring inset-ring-gray-300 group-hover:bg-white group-hover:text-gray-900 dark:text-gray-400 dark:inset-ring-gray-700 dark:group-hover:bg-white/10 dark:group-hover:text-white",
      )}
    >
      <ChevronRight className={clsx(small ? "h-3.5 w-3.5" : "h-4 w-4", "transition-transform", open && "rotate-90")} />
    </span>
  );
}

/** Bottom line of a form card: optional AI button left, cancel and save right. */
export function FormFooter({ onCancel, onSave, ai, error, t }: {
  onCancel: () => void;
  onSave: () => void;
  ai?: { busy: boolean; label: string; busyLabel?: string; onRun: () => void };
  error?: ReactNode;
  t: Translate;
}) {
  return (
    <div className="mt-5 border-t border-gray-200 pt-4 dark:border-white/10">
      {error ? <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {ai ? (
          <button
            type="button"
            onClick={ai.onRun}
            disabled={ai.busy}
            className={`inline-flex items-center gap-x-1.5 disabled:cursor-not-allowed disabled:opacity-60 ${cancelButtonClass}`}
          >
            <Sparkles aria-hidden="true" className="-ml-0.5 size-4 text-indigo-600 dark:text-indigo-400" />
            {ai.busy ? (ai.busyLabel ?? ai.label) : ai.label}
          </button>
        ) : null}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} className={cancelButtonClass}>{t("common.cancel")}</button>
          <button type="button" onClick={onSave} className={saveButtonClass}>{t("common.save")}</button>
        </div>
      </div>
    </div>
  );
}
