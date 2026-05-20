import {
  CircleStackIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  HomeIcon,
  PrinterIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
  type AcademicCapIcon,
} from "@heroicons/react/24/outline";

type SettingsSection = {
  id: string;
  label: string;
  icon: typeof AcademicCapIcon;
  show: boolean;
};

export const settingsInputClass =
  "block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";
export const settingsMonoTextareaClass =
  "block w-full rounded-md bg-white px-3 py-1.5 text-xs font-mono text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";
export const settingsPrimaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500";
export const settingsSecondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:inset-ring-white/5 dark:hover:bg-white/20";
export const settingsDangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-xs inset-ring inset-ring-red-200 hover:bg-red-50 dark:bg-red-500/10 dark:text-red-300 dark:inset-ring-red-500/20 dark:hover:bg-red-500/20";

export function buildSettingsSections({
  t,
  hasAccount,
  hasSessions,
  canPrint,
  isAdmin,
}: {
  t: (key: string) => string;
  hasAccount: boolean;
  hasSessions: boolean;
  canPrint: boolean;
  isAdmin: boolean;
}) {
  const sections: SettingsSection[] = [
    { id: "account", label: t("settings.sectionAccount"), icon: Cog6ToothIcon, show: hasAccount },
    { id: "devices", label: t("settings.sectionDevices"), icon: DevicePhoneMobileIcon, show: hasSessions },
    { id: "app", label: t("settings.sectionApp"), icon: Cog6ToothIcon, show: true },
    { id: "branding", label: t("settings.branding"), icon: HomeIcon, show: isAdmin },
    { id: "printer", label: t("settings.printerTitle"), icon: PrinterIcon, show: canPrint || isAdmin },
    { id: "storage", label: t("settings.externalSources"), icon: CircleStackIcon, show: isAdmin },
    { id: "ai", label: t("settings.sectionAI"), icon: SparklesIcon, show: isAdmin },
    { id: "system", label: t("settings.sectionSystem"), icon: WrenchScrewdriverIcon, show: isAdmin },
  ];

  return sections.filter((section) => section.show);
}
