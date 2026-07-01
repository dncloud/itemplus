"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { Trash2, Upload } from "lucide-react";
import type { User } from "@/lib/api";
import { UserAvatar } from "@/components/ui/user-avatar";

export function SettingsAccountSection({
  t,
  me,
  avatarInputRef,
  displayNameDraft,
  setDisplayNameDraft,
  saveAccount,
  uploadAccountAvatar,
  removeAccountAvatar,
  accountInfoRows,
  accountPermissions,
  accountActiveCheckouts,
  accountDeleteDisabled,
  deleteAccountBusy,
  deleteAccount,
  settingsInputClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
  settingsDangerButtonClass,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  me: User;
  avatarInputRef: RefObject<HTMLInputElement | null>;
  displayNameDraft: string;
  setDisplayNameDraft: Dispatch<SetStateAction<string>>;
  saveAccount: () => void;
  uploadAccountAvatar: (file?: File | null) => Promise<void>;
  removeAccountAvatar: () => Promise<void>;
  accountInfoRows: { label: string; value: string }[];
  accountPermissions: string[];
  accountActiveCheckouts: number;
  accountDeleteDisabled: boolean;
  deleteAccountBusy: boolean;
  deleteAccount: () => Promise<void>;
  settingsInputClass: string;
  settingsPrimaryButtonClass: string;
  settingsSecondaryButtonClass: string;
  settingsDangerButtonClass: string;
}) {
  return (
    <section id="account" className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">{t("settings.sectionAccount")}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("settings.accountDescription")}</p>
      </div>

      <div className="rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-gray-800/50 dark:outline-white/10">
        <div className="space-y-8 px-4 py-6 sm:p-8 md:max-w-4xl">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
              <label className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.avatar")}</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <UserAvatar
                  name={me.name || me.email || undefined}
                  avatarUrl={me.avatar_url}
                  size="lg"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className={settingsSecondaryButtonClass}
                  >
                    <Upload className="h-4 w-4" />
                    {t("common.upload")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeAccountAvatar()}
                    disabled={!me.avatar_url}
                    className={`${settingsDangerButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("common.remove")}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      void uploadAccountAvatar(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center">
              <label className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.displayName")}</label>
              <input value={displayNameDraft} onChange={(e) => setDisplayNameDraft(e.target.value)} className={settingsInputClass} />
              <button onClick={saveAccount} className={settingsPrimaryButtonClass}>
                {t("common.save")}
              </button>
            </div>
          </div>

          <div className="space-y-5 border-t border-gray-200 pt-8 dark:border-white/10">
            <dl className="space-y-5">
              {accountInfoRows.map((row) => (
                <div key={row.label} className="space-y-1">
                  <dt className="text-sm/6 font-medium text-gray-900 dark:text-white">{row.label}</dt>
                  <dd className="break-all text-sm/6 text-gray-500 dark:text-gray-400">{row.value}</dd>
                </div>
              ))}
              <div className="space-y-2">
                <dt className="text-sm/6 font-medium text-gray-900 dark:text-white">{t("settings.permissions")}</dt>
                <dd className="flex flex-wrap gap-2">
                  {accountPermissions.length > 0 ? accountPermissions.map((permission) => (
                    <span key={permission} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                      {permission}
                    </span>
                  )) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t("common.none")}</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4 border-t border-gray-200 pt-8 dark:border-white/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-sm/6 font-semibold text-gray-900 dark:text-white">{t("settings.deleteAccountTitle")}</h3>
                <p className="text-sm/6 text-gray-500 dark:text-gray-400">
                  {me.is_admin
                    ? t("settings.deleteAccountAdminBlocked")
                    : accountActiveCheckouts > 0
                      ? t("settings.deleteAccountActiveCheckouts", { count: accountActiveCheckouts })
                      : t("settings.deleteAccountAvailableHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={accountDeleteDisabled}
                className={`${settingsDangerButtonClass} shrink-0 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {deleteAccountBusy ? t("common.loading") : t("settings.deleteAccountConfirm")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
