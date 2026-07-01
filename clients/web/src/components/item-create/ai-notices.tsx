"use client";

import { X } from "lucide-react";
import { BarcodePreview } from "@/components/item-create/ui";

export function BarcodeDraftNotice({
  t,
  barcodeDraft,
  clearBarcodeDraft,
}: {
  t: (key: string) => string;
  barcodeDraft: { code: string; symbology?: string | null };
  clearBarcodeDraft: () => void;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{t("items.barcodeCaptured")}</p>
          <p className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">
            {barcodeDraft.code}
            {barcodeDraft.symbology ? ` · ${barcodeDraft.symbology}` : ""}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <BarcodePreview code={barcodeDraft.code} symbology={barcodeDraft.symbology} />
          <button
            type="button"
            onClick={clearBarcodeDraft}
            className="inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
