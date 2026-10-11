"use client";

import Link from "next/link";
import { Menu, MenuButton, MenuItem, MenuItems, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import SelectPicker from "@/components/ui/select-picker";
import {
  ArrowLeftRight,
  CircleCheck,
  Check,
  ChevronRight,
  ClipboardList,
  Ellipsis,
  Smartphone,
  Info,
  Pencil,
  Printer,
  QrCode,
  Trash2,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import type { Item } from "@/lib/api";
import { formatCheckoutRelativeState } from "@/lib/checkout-relative-time";

export function ItemDetailLoadingView() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
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
                <X className="h-4 w-4 text-red-400" />
              </div>
            ) : (
              <div className="rounded-full bg-emerald-500/15 p-1">
                <CircleCheck className="h-4 w-4 text-emerald-400" />
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
            <X className="h-4 w-4" />
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
  canViewInventory,
  inventoryHref,
  canViewMaintenance,
  maintenanceHref,
  maintenanceDueCount,
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
  meta,
  qrCodeURL,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  realm: "archive" | "collection";
  itemName: string;
  // One quiet line under the name, for example when the item was created.
  meta?: string;
  // Address of the item's QR code picture; "{color}" stands for the hex colour.
  qrCodeURL?: string;
  checkoutSent: boolean;
  checkoutBlocked: boolean;
  showCheckout: boolean;
  setShowCheckout: (value: boolean) => void;
  canWriteItems: boolean;
  canViewInventory: boolean;
  inventoryHref: string;
  canViewMaintenance: boolean;
  maintenanceHref: string;
  maintenanceDueCount: number;
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
    <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:text-left lg:mb-8">
      <div className="space-y-1 py-3">
        <nav className="text-sm font-medium text-gray-500 dark:text-gray-400">
          <ol className="flex items-center justify-center sm:justify-start">
            <li>
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                {t("nav.dashboard")}
              </Link>
            </li>
            <li className="flex items-center px-1 opacity-25">
              <ChevronRight className="inline-block h-4 w-4" />
            </li>
            <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
            <li className="flex items-center px-1 opacity-25">
              <ChevronRight className="inline-block h-4 w-4" />
            </li>
            <li>
              <Link href="/items" className="hover:text-gray-900 dark:hover:text-white">
                {t("items.title")}
              </Link>
            </li>
            <li className="flex items-center px-1 opacity-25">
              <ChevronRight className="inline-block h-4 w-4" />
            </li>
            <li className="text-gray-900 dark:text-white">{t("itemDetail.details")}</li>
          </ol>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{itemName}</h1>
        {meta ? <p className="text-xs text-gray-500 dark:text-gray-400">{meta}</p> : null}
      </div>
      <div className="flex items-center justify-center gap-2 rounded-sm px-2 py-3 sm:justify-end sm:bg-transparent sm:px-0">
        <button
          type="button"
          onClick={() => {
            setShowCheckout(!showCheckout);
          }}
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
          {checkoutSent ? <Check className="h-4 w-4" /> : <ArrowLeftRight className="h-4 w-4" />}
        </button>
        {canViewInventory ? (
          <Link
            href={inventoryHref}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t("nav.inventoryMovements")}
          >
            <ClipboardList className="h-4 w-4" />
          </Link>
        ) : null}
        {canViewMaintenance ? (
          <Link
            href={maintenanceHref}
            className={`relative inline-flex items-center justify-center rounded-lg border p-2 text-sm transition ${
              maintenanceDueCount > 0
                ? "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-500/50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
            title={t("maintenance.title")}
          >
            <Wrench className="h-4 w-4" />
            {maintenanceDueCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white">
                {maintenanceDueCount}
              </span>
            ) : null}
          </Link>
        ) : null}
        {qrCodeURL ? (
          <Popover className="relative">
            <PopoverButton
              title={t("itemDetail.qrCode")}
              aria-label={t("itemDetail.qrCode")}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <QrCode className="h-4 w-4" />
            </PopoverButton>
            <PopoverPanel
              anchor="bottom end"
              transition
              className="z-50 mt-2 rounded-xl bg-white p-3 shadow-lg outline-1 outline-black/5 transition data-[closed]:scale-95 data-[closed]:opacity-0 dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
            >
              <img src={qrCodeURL.replace("{color}", "000000")} alt={t("itemDetail.qrCode")} className="h-40 w-40 dark:hidden" />
              <img src={qrCodeURL.replace("{color}", "ffffff")} alt={t("itemDetail.qrCode")} className="hidden h-40 w-40 dark:block" />
            </PopoverPanel>
          </Popover>
        ) : null}
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
              <QrCode className="h-4 w-4" />
            ) : (
              <Printer className="h-4 w-4" />
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
            <Smartphone className="h-4 w-4" />
          </button>
        ) : null}
        {(canPrintActions || canRequestPhoto || canWriteItems || canDeleteItems) ? (
          <span className="hidden h-5 w-px bg-gray-200 dark:bg-white/10 sm:inline-block" />
        ) : null}
        {canWriteItems ? (
          <Link
            href={editHref}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:outline-gray-700 dark:hover:bg-white/20"
          >
            <Pencil aria-hidden="true" className="-ml-0.5 size-4 text-gray-400 dark:text-gray-300" />
            {t("itemDetail.edit")}
          </Link>
        ) : null}
        {canDeleteItems ? (
          pendingDelete ? (
            <span className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 dark:border-gray-700">
              <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </span>
          ) : (
            <Menu as="div" className="relative">
              <MenuButton
                title={t("items.moreActions")}
                aria-label={t("items.moreActions")}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Ellipsis className="h-4 w-4" />
              </MenuButton>
              <MenuItems
                anchor="bottom end"
                transition
                className="z-50 mt-2 w-44 origin-top-right rounded-md bg-white py-1 shadow-lg outline-1 outline-black/5 transition data-[closed]:scale-95 data-[closed]:opacity-0 dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
              >
                <MenuItem>
                  <button
                    type="button"
                    onClick={remove}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 data-[focus]:bg-red-50 data-[focus]:outline-hidden dark:text-red-400 dark:data-[focus]:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("common.delete")}
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          )
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

  const inputClass =
    "block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 disabled:opacity-60 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";
  const labelClass = "block text-sm/6 font-medium text-gray-900 dark:text-white";
  const secondaryButtonClass =
    "rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/10 dark:text-gray-100 dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20";

  // A card in the page, like the item's other sections.
  return (
    <section className="rounded-xl bg-white shadow-xs outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          requestCheckout();
        }}
      >
        <div className="space-y-6 px-6 py-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("itemDetail.requestTitle")}</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label htmlFor="checkout-days" className={labelClass}>{t("itemDetail.duration")}</label>
              <div className="mt-2">
                <input
                  id="checkout-days"
                  type="number"
                  min={1}
                  value={checkoutDays}
                  onChange={(e) => setCheckoutDays(Number(e.target.value))}
                  disabled={checkoutSubmitting}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="sm:col-span-4">
              <label htmlFor="checkout-note" className={labelClass}>{t("itemDetail.note")}</label>
              <div className="mt-2">
                <input
                  id="checkout-note"
                  value={checkoutNote}
                  onChange={(e) => setCheckoutNote(e.target.value)}
                  placeholder={t("itemDetail.noteHint")}
                  disabled={checkoutSubmitting}
                  className={inputClass}
                />
              </div>
            </div>
            {canManageCheckout && checkoutNow ? (
              <div className="sm:col-span-3">
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
          </div>
          {canManageCheckout && hasBundleComponents ? (
            <fieldset>
              <legend className={labelClass}>{t("itemDetail.includeComponents")}</legend>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("itemDetail.includeComponentsHint")}</p>
              <div className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {item.components?.map((component) => (
                  <label key={component.id} className="flex cursor-pointer items-center gap-3 border-t border-gray-200 py-3 text-sm dark:border-white/10">
                    <input
                      type="checkbox"
                      checked={selectedComponentIDs.includes(component.id)}
                      onChange={() => toggleComponent(component.id)}
                      disabled={checkoutSubmitting}
                      className="size-4 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-white/10 dark:bg-white/5"
                    />
                    <span className="min-w-0 truncate font-medium text-gray-900 dark:text-white">{component.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-white/10">
          <button type="button" onClick={close} disabled={checkoutSubmitting} className={secondaryButtonClass}>
            {t("common.cancel")}
          </button>
          {canManageCheckout && checkoutNow ? (
            <button type="button" onClick={checkoutNow} disabled={checkoutSubmitting} className={secondaryButtonClass}>
              {t("itemDetail.checkoutNow")}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={checkoutSubmitting}
            className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
          >
            {checkoutSubmitting ? t("common.loading") : t("itemDetail.sendRequest")}
          </button>
        </div>
      </form>
    </section>
  );
}

// A waiting loan request. The requester reads that it is waiting; a manager
// reads who asked. Deciding happens on the loans page, so this only links there.
export function ItemCheckoutPendingBanner({ t, own, others, href }: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  own: boolean;
  others: string[];
  href: string;
}) {
  return (
    <section className="rounded-md bg-blue-50 p-4 dark:bg-blue-500/10 dark:outline dark:outline-blue-500/20">
      <div className="flex items-start gap-3">
        <Info aria-hidden="true" className="size-5 shrink-0 text-blue-400" />
        <div className="min-w-0 flex-1 text-sm text-blue-700 dark:text-blue-300">
          {own ? <p className="font-medium text-blue-800 dark:text-blue-200">{t("itemDetail.requestWaitingOwn")}</p> : null}
          {others.length > 0 ? (
            <p className={own ? "mt-1" : "font-medium text-blue-800 dark:text-blue-200"}>
              {t("itemDetail.requestWaitingFrom", { users: others.join(", ") })}
            </p>
          ) : null}
        </div>
        <Link href={href} className="shrink-0 text-sm font-medium whitespace-nowrap text-blue-700 hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-200">
          {t("itemDetail.requestOpenLoans")} <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </section>
  );
}

export function ItemMaintenanceBanner({
  dueCount,
  overdueCount,
  t,
  maintenanceHref,
}: {
  dueCount: number;
  overdueCount: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
  maintenanceHref: string;
}) {
  const hasOverdue = overdueCount > 0;

  return (
    <section className="border-b border-gray-200 pb-6 dark:border-white/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Wrench className={`mt-0.5 h-5 w-5 shrink-0 ${hasOverdue ? "text-rose-500" : "text-amber-500"}`} />
          <div className="min-w-0">
            <p className={hasOverdue ? "text-sm font-medium text-rose-300" : "text-sm font-medium text-amber-300"}>
              {hasOverdue
                ? t("maintenance.alertOverdue", { count: overdueCount })
                : t("maintenance.alertDue", { count: dueCount })}
            </p>
            <p className={hasOverdue ? "mt-1 text-sm text-rose-200/85" : "mt-1 text-sm text-amber-200/85"}>
              {t("maintenance.summaryHint", { count: dueCount })}
            </p>
          </div>
        </div>
        <Link
          href={maintenanceHref}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white ${
            hasOverdue
              ? "bg-rose-600 hover:bg-rose-500 focus-visible:outline-rose-600 dark:bg-rose-500 dark:hover:bg-rose-400 dark:focus-visible:outline-rose-500"
              : "bg-amber-600 hover:bg-amber-500 focus-visible:outline-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400 dark:focus-visible:outline-amber-500"
          } focus-visible:outline-2 focus-visible:outline-offset-2`}
        >
          <Wrench className="h-4 w-4" />
          {t("maintenance.openPanel")}
        </Link>
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
  const primaryUserName = checkoutUsers[0]?.user_name || item.checked_out_to.user_name || t("users.deletedUser");
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
  const isOverdue = Boolean(item.checked_out_to.is_overdue);
  // An alert in the app's usual style: green while the loan is in time,
  // yellow once it is overdue.
  const BannerIcon = isOverdue ? TriangleAlert : CircleCheck;
  const bannerClass = isOverdue
    ? "rounded-md bg-yellow-50 p-4 dark:bg-yellow-500/10 dark:outline dark:outline-yellow-500/15"
    : "rounded-md bg-green-50 p-4 dark:bg-green-500/10 dark:outline dark:outline-green-500/20";
  const bannerIconClass = isOverdue ? "size-5 shrink-0 text-yellow-400 dark:text-yellow-300" : "size-5 shrink-0 text-green-400";
  const bannerTitleClass = isOverdue
    ? "text-sm font-medium text-yellow-800 dark:text-yellow-100"
    : "text-sm font-medium text-green-800 dark:text-green-200";
  const bannerMetaClass = isOverdue
    ? "mt-1 text-sm text-yellow-700 dark:text-yellow-100/80"
    : "mt-1 text-sm text-green-700 dark:text-green-200/85";
  const bannerButtonClass = isOverdue
    ? "bg-white text-yellow-800 inset-ring-yellow-600/25 hover:bg-yellow-100 dark:bg-yellow-500/15 dark:text-yellow-100 dark:inset-ring-yellow-400/30 dark:hover:bg-yellow-500/25"
    : "bg-white text-green-800 inset-ring-green-600/25 hover:bg-green-100 dark:bg-green-500/15 dark:text-green-100 dark:inset-ring-green-400/30 dark:hover:bg-green-500/25";

  return (
    <section className={bannerClass}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <BannerIcon aria-hidden="true" className={bannerIconClass} />
          <div className="min-w-0">
            <p className={bannerTitleClass}>
              {t("itemDetail.checkedOutTo")} {checkoutLabel}
            </p>
            {(item.checked_out_to.since || item.checked_out_to.due_date) ? (
              <p className={bannerMetaClass}>
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
                          {entry.user_name || t("users.deletedUser")}
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
                            <ArrowLeftRight className="h-3.5 w-3.5" />
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
            type="button"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold shadow-xs inset-ring disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none ${bannerButtonClass}`}
          >
            {returningCheckoutID !== null ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <ArrowLeftRight className="h-4 w-4" />
            )}
            {t("itemDetail.returnItem")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
