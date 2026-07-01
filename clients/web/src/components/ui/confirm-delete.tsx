"use client";

import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { wsClient } from "@/lib/ws";
import { useApp } from "@/lib/app-context";

type DeleteTarget = { id: number; name: string; type: string };

function getDeleteEventTarget(data: Record<string, unknown>): DeleteTarget {
  return {
    id: (data.entity_id || data.item_id) as number,
    name: (data.entity_name || data.item_name || "") as string,
    type: (data.entity_type || "item") as string,
  };
}

function matchesDeleteTarget(target: DeleteTarget | null, candidate: Pick<DeleteTarget, "id" | "type">) {
  return !!target && target.id === candidate.id && target.type === candidate.type;
}

/**
 * Unified delete flow:
 * - iOS Bestätigung an: WS zuerst, Fallback auf Name-Eingabe wenn kein iOS verbunden
 * - iOS Bestätigung aus: Immer Name-Eingabe
 */
export function useDeleteFlow(opts: {
  realm: string;
  onDeleted: (entityId: number, entityType: string) => void;
}) {
  const { iosDeleteConfirm } = useApp();
  const [pending, setPending] = useState<DeleteTarget | null>(null);
  const [confirm, setConfirm] = useState<DeleteTarget | null>(null);
  const dismissedRef = useRef<{ id: number; type: string; until: number } | null>(null);
  const pendingRef = useRef<DeleteTarget | null>(null);
  const confirmRef = useRef<DeleteTarget | null>(null);

  const onDeletedRef = useRef(opts.onDeleted);

  useEffect(() => {
    onDeletedRef.current = opts.onDeleted;
  }, [opts.onDeleted]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    confirmRef.current = confirm;
  }, [confirm]);

  useEffect(() => {
    const unsub1 = wsClient.on("delete.done", (data) => {
      const { id, type } = getDeleteEventTarget(data);
      const activePending = pendingRef.current;
      const activeConfirm = confirmRef.current;
      if (!matchesDeleteTarget(activePending, { id, type }) && !matchesDeleteTarget(activeConfirm, { id, type })) {
        return;
      }
      setPending(null);
      setConfirm(null);
      onDeletedRef.current(id, type);
    });
    const unsub2 = wsClient.on("delete.rejected", (data) => {
      const { id, type } = getDeleteEventTarget(data);
      const activePending = pendingRef.current;
      if (!matchesDeleteTarget(activePending, { id, type })) {
        return;
      }
      setPending(null);
    });
    const unsub3 = wsClient.on("delete.no_device", (data) => {
      const { id, name, type } = getDeleteEventTarget(data);
      const activePending = pendingRef.current;
      const activeConfirm = confirmRef.current;
      if (!matchesDeleteTarget(activePending, { id, type }) && !matchesDeleteTarget(activeConfirm, { id, type })) {
        return;
      }
      const dismissed = dismissedRef.current;
      if (dismissed && dismissed.id === id && dismissed.type === type && dismissed.until > Date.now()) {
        setPending(null);
        return;
      }
      setPending(null);
      setConfirm({ id, name, type });
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const requestDelete = (id: number, name: string, entityType: string) => {
    if (iosDeleteConfirm) {
      // Try iOS first
      wsClient.send("delete.request", {
        entity_id: id,
        entity_name: name,
        entity_type: entityType,
        realm: opts.realm,
      });
      setPending({ id, name, type: entityType });
      setTimeout(() => setPending((p) => (p?.id === id && p.type === entityType ? null : p)), 30000);
    } else {
      // Skip iOS, go straight to name confirmation
      setConfirm({ id, name, type: entityType });
    }
  };

  const cancelConfirm = () => {
    setConfirm((current) => {
      if (current) {
        dismissedRef.current = { id: current.id, type: current.type, until: Date.now() + 1500 };
      }
      return null;
    });
  };

  return { pending, confirm, requestDelete, cancelConfirm };
}

/**
 * Confirm Delete Dialog — requires typing the item name to confirm.
 */
export function ConfirmDelete({ name, onConfirm, onCancel, t }: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const [input, setInput] = useState("");
  const targetName = name.trim();
  const matches = targetName.length > 0 && input.trim().toLowerCase() === targetName.toLowerCase();
  const handleConfirm = () => {
    if (!matches) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <TriangleAlert className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t("delete.title")}</h2>
            <p className="text-xs text-gray-500">{t("delete.irreversible")}</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("delete.typeName")}{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-900 dark:bg-gray-900 dark:text-white">
            &quot;{targetName || "?"}&quot;
          </code>
        </p>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={targetName}
          autoFocus
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!matches}
            className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            {t("delete.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
