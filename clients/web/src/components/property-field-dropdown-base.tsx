"use client";

import { useEffect, useRef } from "react";

export const selectButtonCls =
  "grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pr-2 pl-3 text-left text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:focus-visible:outline-indigo-500";
export const selectOptionsCls =
  "absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg outline-1 outline-black/5 sm:text-sm dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[scrollbar-color:theme(colors.gray.400)_transparent] dark:[scrollbar-width:auto] dark:[&::-webkit-scrollbar-thumb]:bg-gray-400/80 dark:[&::-webkit-scrollbar-thumb]:border-[3px] dark:[&::-webkit-scrollbar-thumb]:border-solid dark:[&::-webkit-scrollbar-thumb]:border-gray-800";
export const selectOptionCls =
  "group relative block w-full cursor-default py-2 pr-9 pl-3 text-left text-gray-900 select-none hover:bg-indigo-600 hover:text-white focus:bg-indigo-600 focus:text-white focus:outline-hidden dark:text-white dark:hover:bg-indigo-500 dark:focus:bg-indigo-500";
export const flatSelectedBadgeCls =
  "inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-400/10 dark:text-gray-400";

export function useDismissibleDropdown(open: boolean, onClose: () => void) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  return wrapperRef;
}

export function DropdownChevron() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 sm:size-4 dark:text-gray-400">
      <path d="M5.22 10.22a.75.75 0 0 1 1.06 0L8 11.94l1.72-1.72a.75.75 0 1 1 1.06 1.06l-2.25 2.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 0 1 0-1.06ZM10.78 5.78a.75.75 0 0 1-1.06 0L8 4.06 6.28 5.78a.75.75 0 0 1-1.06-1.06l2.25-2.25a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" fillRule="evenodd" />
    </svg>
  );
}
