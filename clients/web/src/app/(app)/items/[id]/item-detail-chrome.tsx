"use client";

import Link from "next/link";
import SelectPicker from "@/components/select-picker";
import {
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  DevicePhoneMobileIcon,
  InformationCircleIcon,
  PencilIcon,
  PrinterIcon,
  QrCodeIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { Item } from "@/lib/api";
import { formatCheckoutRelativeState } from "@/lib/checkout-relative-time";

export function ItemDetailLoadingView() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}

export function ItemDetailNotification({
  notification,
  clearNotification,
}: {
  notification: { title: string; message?: string; tone: "success" | "error" };
  clearNotification: () => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-sm">
      <div className="rounded-xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5">
            {notification.tone === "error" ? (
              <div className="rounded-full bg-red-500/15 p-1">
                <XMarkIcon className="h-4 w-4 text-red-400" />
              </div>
            ) : (
              <div className="rounded-full bg-emerald-500/15 p-1">
                <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">{notification.title}</p>
            {notification.message ? <p className="mt-1 text-sm text-gray-400">{notification.message}</p> : null}
          </div>
          <button
            type="button"
            onClick={clearNotification}
            className="rounded-md p-1 text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ItemDetailHeader({
  t,
  realm,
  itemName,
  checkoutSent,
  checkoutBlocked,
  showCheckout,
  setShowCheckout,
  canWriteItems,
  canPrintActions,
  canRequestPhoto,
  printing,
  printDone,
  printQR,
  photoRequested,
  requestPhotoFromPhone,
  editHref,
  canDeleteItems,
  pendingDelete,
  remove,
}: {
  t: (key: string) => string;
  realm: "archive" | "collection";
  itemName: string;
  checkoutSent: boolean;
  checkoutBlocked: boolean;
  showCheckout: boolean;
  setShowCheckout: (value: boolean) => void;
  canWriteItems: boolean;
  canPrintActions: boolean;
  canRequestPhoto: boolean;
  printing: boolean;
  printDone: boolean;
  printQR: () => void;
  photoRequested: boolean;
  requestPhotoFromPhone: () => void;
  editHref: string;
  canDeleteItems: boolean;
  pendingDelete: boolean;
  remove: () => void;
}) {
  return (
    <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:border-b sm:border-gray-200 sm:text-left lg:mb-8 dark:border-white/10">
      <div className="space-y-1 py-3">
        <nav className="text-sm font-medium text-gray-500 dark:text-gray-400">
          <ol className="flex items-center justify-center sm:justify-start">
            <li>
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                {t("nav.dashboard")}
              </Link>
            </li>
            <li className="flex items-center px-1 opacity-25">
              <ChevronRightIcon className="inline-block h-4 w-4" />
            </li>
            <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
            <li className="flex items-center px-1 opacity-25">
              <ChevronRightIcon className="inline-block h-4 w-4" />
            </li>
            <li>
              <Link href="/items" className="hover:text-gray-900 dark:hover:text-white">
                {t("items.title")}
              </Link>
            </li>
            <li className="flex items-center px-1 opacity-25">
              <ChevronRightIcon className="inline-block h-4 w-4" />
            </li>
            <li className="text-gray-900 dark:text-white">{t("itemDetail.details")}</li>
          </ol>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{itemName}</h1>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
        <button
          type="button"
          onClick={() => setShowCheckout(!showCheckout)}
          disabled={checkoutSent || checkoutBlocked}
          title={
            checkoutSent ? t("itemDetail.requested")
            : checkoutBlocked ? t("itemDetail.notAvailable")
            : t("itemDetail.requestCheckout")
          }
          className={`inline-flex items-center justify-center rounded-lg border p-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
            checkoutSent
              ? "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-500"
              : checkoutBlocked
                ? "border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-500"
                : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          }`}
        >
          {checkoutSent ? <CheckIcon className="h-4 w-4" /> : <ArrowsRightLeftIcon className="h-4 w-4" />}
        </button>
        {canPrintActions ? (
          <button
            type="button"
            onClick={printQR}
            disabled={printing || printDone}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={printing ? t("common.print") : "QR"}
          >
            {printing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : printDone ? (
              <QrCodeIcon className="h-4 w-4" />
            ) : (
              <PrinterIcon className="h-4 w-4" />
            )}
          </button>
        ) : null}
        {canRequestPhoto ? (
          <button
            type="button"
            onClick={requestPhotoFromPhone}
            disabled={photoRequested}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t("attachments.upload")}
          >
            <DevicePhoneMobileIcon className="h-4 w-4" />
          </button>
        ) : null}
        {(canPrintActions || canRequestPhoto || canWriteItems || canDeleteItems) ? (
          <span className="hidden h-5 w-px bg-gray-200 dark:bg-white/10 sm:inline-block" />
        ) : null}
        {canWriteItems ? (
          <Link
            href={editHref}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t("itemDetail.edit")}
          >
            <PencilIcon className="h-4 w-4" />
          </Link>
        ) : null}
        {canDeleteItems ? (
          <button
            type="button"
            onClick={remove}
            disabled={pendingDelete}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t("common.delete")}
          >
            {pendingDelete ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <TrashIcon className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ItemCheckoutRequestPanel({
  t,
  item,
  canManageCheckout,
  checkoutDays,
  setCheckoutDays,
  checkoutNote,
  setCheckoutNote,
  selectedComponentIDs,
  setSelectedComponentIDs,
  checkoutUsers,
  selectedCheckoutUserID,
  setSelectedCheckoutUserID,
  checkoutSubmitting,
  requestCheckout,
  checkoutNow,
  close,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  item: Item;
  canManageCheckout: boolean;
  checkoutDays: number;
  setCheckoutDays: (value: number) => void;
  checkoutNote: string;
  setCheckoutNote: (value: string) => void;
  selectedComponentIDs: number[];
  setSelectedComponentIDs: (value: number[]) => void;
  checkoutUsers: Array<{ id: number; name: string }>;
  selectedCheckoutUserID: number | "";
  setSelectedCheckoutUserID: (value: number | "") => void;
  checkoutSubmitting: boolean;
  requestCheckout: () => void;
  checkoutNow?: () => void;
  close: () => void;
}) {
  const hasBundleComponents = !!item.components?.length;
  const toggleComponent = (componentID: number) => {
    setSelectedComponentIDs(
      selectedComponentIDs.includes(componentID)
        ? selectedComponentIDs.filter((id) => id !== componentID)
        : [...selectedComponentIDs, componentID],
    );
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3 dark:border-blue-800 dark:bg-blue-900/10">
      <h3 className="text-sm font-semibold">{t("itemDetail.requestTitle")}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t("itemDetail.duration")}</label>
          <input
            type="number"
            min={1}
            value={checkoutDays}
            onChange={(e) => setCheckoutDays(Number(e.target.value))}
            disabled={checkoutSubmitting}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t("itemDetail.note")}</label>
          <input
            value={checkoutNote}
            onChange={(e) => setCheckoutNote(e.target.value)}
            placeholder={t("itemDetail.noteHint")}
            disabled={checkoutSubmitting}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
      </div>
      {canManageCheckout && checkoutNow ? (
        <div>
          <SelectPicker
            label={t("itemDetail.checkoutUser")}
            value={selectedCheckoutUserID}
            onChange={(value) => setSelectedCheckoutUserID(typeof value === "number" ? value : "")}
            options={checkoutUsers.map((user) => ({ id: user.id, name: user.name }))}
            placeholder={t("itemDetail.checkoutCurrentUser")}
            clearLabel={t("itemDetail.checkoutCurrentUser")}
          />
        </div>
      ) : null}
      {canManageCheckout && hasBundleComponents ? (
        <div className="space-y-2 rounded-lg border border-blue-200/80 bg-white/70 p-3 dark:border-blue-800/80 dark:bg-gray-950/20">
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{t("itemDetail.includeComponents")}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("itemDetail.includeComponentsHint")}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {item.components?.map((component) => {
              const selected = selectedComponentIDs.includes(component.id);
              return (
                <label
                  key={component.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                    selected
                      ? "border-blue-400 bg-blue-100/80 dark:border-blue-500 dark:bg-blue-500/10"
                      : "border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleComponent(component.id)}
                    disabled={checkoutSubmitting}
                    className="mt-0.5 size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-white">{component.name}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          onClick={requestCheckout}
          disabled={checkoutSubmitting}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {checkoutSubmitting ? t("common.loading") : t("itemDetail.sendRequest")}
        </button>
        {canManageCheckout && checkoutNow ? (
          <button
            onClick={checkoutNow}
            disabled={checkoutSubmitting}
            className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
          >
            {t("itemDetail.checkoutNow")}
          </button>
        ) : null}
        <button
          onClick={close}
          disabled={checkoutSubmitting}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

export function ItemCheckoutPendingBanner({ t }: { t: (key: string) => string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-blue-200 bg-blue-50/70 dark:border-blue-400/20 dark:bg-blue-400/10">
      <div className="flex items-start gap-3 px-4 py-4 sm:px-6">
        <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-300">{t("itemDetail.requested")}</p>
          <p className="mt-1 text-sm text-blue-800/80 dark:text-blue-200/80">{t("itemDetail.requestTitle")}</p>
        </div>
      </div>
    </section>
  );
}

export function ItemCheckoutActiveBanner({
  item,
  canManageCheckout,
  fmtDate,
  t,
  returningCheckoutID,
  checkinItem,
}: {
  item: Item;
  canManageCheckout: boolean;
  fmtDate: (value?: string | null) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  returningCheckoutID: number | null;
  checkinItem: (checkoutID?: number) => void;
}) {
  if (!item.checked_out_to) return null;
  const checkoutUsers = item.checked_out_to.users || [];
  const primaryUserName = checkoutUsers[0]?.user_name || item.checked_out_to.user_name || `User #${item.checked_out_to.user_id}`;
  const checkoutLabel = checkoutUsers.length > 1 ? `${primaryUserName} +${checkoutUsers.length - 1}` : primaryUserName;
  const includedComponentIDs = new Set(item.checked_out_to.component_ids || []);
  const includedComponents = (item.components || []).filter((component) => includedComponentIDs.has(component.id));
  const relativeDueState = formatCheckoutRelativeState({
    dueDate: item.checked_out_to.due_date,
    isOverdue: item.checked_out_to.is_overdue,
    overdueDays: item.checked_out_to.overdue_days,
    t,
    compact: true,
  });

  return (
    <section className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/20 dark:bg-emerald-400/10">
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
              {t("itemDetail.checkedOutTo")} {checkoutLabel}
            </p>
            {(item.checked_out_to.since || item.checked_out_to.due_date) ? (
              <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
                {item.checked_out_to.since ? `${t("itemDetail.since")} ${fmtDate(item.checked_out_to.since)}.` : ""}
                {item.checked_out_to.since && item.checked_out_to.due_date ? " " : ""}
                {item.checked_out_to.due_date ? `${t("itemDetail.dueDate")} ${fmtDate(item.checked_out_to.due_date)}` : ""}
                {item.checked_out_to.due_date && relativeDueState ? ` (${relativeDueState})` : ""}
              </p>
            ) : null}
            {checkoutUsers.length > 1 ? (
              <div className="mt-2 space-y-2 text-sm text-emerald-800/80 dark:text-emerald-200/80">
                <p>{t("itemDetail.loanedUsers")}:</p>
                <div className="space-y-2">
                  {checkoutUsers.map((entry) => (
                    <div
                      key={entry.checkout_id}
                      className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-white/75 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-300/20 dark:bg-emerald-500/10"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-emerald-950 dark:text-emerald-100">
                          {entry.user_name || `User #${entry.user_id}`}
                        </p>
                        {entry.due_date ? (
                          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                            {t("itemDetail.dueDate")} {fmtDate(entry.due_date)}
                          </p>
                        ) : null}
                      </div>
                      {canManageCheckout ? (
                        <button
                          type="button"
                          onClick={() => checkinItem(entry.checkout_id)}
                          disabled={returningCheckoutID !== null}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-300/20 dark:bg-emerald-500/20 dark:text-emerald-50 dark:hover:bg-emerald-500/30"
                        >
                          {returningCheckoutID === entry.checkout_id ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
                          )}
                          {t("itemDetail.returnItem")}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {includedComponents.length > 0 ? (
              <div className="mt-2 space-y-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
                <p>{t("itemDetail.includedComponents")}:</p>
                <div className="flex flex-wrap gap-2">
                  {includedComponents.map((component) => (
                    <Link
                      key={component.id}
                      href={`/items/${component.id}`}
                      className="rounded-full border border-emerald-200 bg-emerald-100/80 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-200 dark:border-emerald-300/20 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:bg-emerald-500/20"
                    >
                      {component.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {canManageCheckout && checkoutUsers.length <= 1 ? (
          <button
            onClick={() => checkinItem(checkoutUsers[0]?.checkout_id)}
            disabled={returningCheckoutID !== null}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:focus-visible:outline-emerald-500"
          >
            {returningCheckoutID !== null ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <ArrowsRightLeftIcon className="h-4 w-4" />
            )}
            {t("itemDetail.returnItem")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
