"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Fragment, useEffect, useState } from "react";
import { Dialog, DialogPanel, Radio, RadioGroup, Tab, TabGroup, TabList, TabPanel, TabPanels, Transition, TransitionChild } from "@headlessui/react";
import {
  Archive,
  LogOut,
  ArrowLeftRight,
  Building2,
  BarChart3,
  CalendarDays,
  Database,
  ClipboardList,
  Settings,
  Gem,
  Monitor,
  Box,
  House,
  MapPin,
  Moon,
  Plus,
  Printer,
  Sparkles,
  Sun,
  Tag,
  CircleUser,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { LogoFull } from "@/components/branding/logo";
import { api, type SidebarFavorite } from "@/lib/api";

const enableNavPrefetch = process.env.NODE_ENV === "production";

const navItems = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: House },
  { href: "/chat", labelKey: "nav.chat", icon: Sparkles, admin: true },
  { href: "/ai-usage", labelKey: "nav.aiUsage", icon: BarChart3, admin: true },
  { href: "/items", labelKey: "nav.items", icon: Box, perm: "items.read" },
  { href: "/categories", labelKey: "nav.categories", icon: Tag, perm: "categories.read" },
  { href: "/locations", labelKey: "nav.locations", icon: MapPin, perm: "locations.read" },
  { href: "/vendors", labelKey: "nav.vendors", icon: Building2, perm: "vendors.read" },
  { href: "/inventory-checks", labelKey: "nav.inventoryChecks", icon: ClipboardList, perm: "inventory.read" },
  { href: "/inventory-movements", labelKey: "nav.inventoryMovements", icon: ClipboardList, perm: "inventory.read" },
  { href: "/maintenance", labelKey: "nav.maintenance", icon: CalendarDays, perm: "maintenance.read" },
  { href: "/checkouts", labelKey: "nav.checkouts", icon: ArrowLeftRight, perm: "checkout.manage" },
  { href: "/users", labelKey: "nav.users", icon: Users, admin: true },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

const primaryNav = ["/dashboard", "/items", "/categories", "/locations", "/vendors"];
const operationsNav = ["/checkouts", "/inventory-checks", "/inventory-movements", "/maintenance"];
const systemNav = ["/users", "/chat", "/ai-usage"];
const settingsNav = ["/settings"];
const settingsNavItems = [
  { href: "/settings?section=account", labelKey: "settings.sectionAccount", icon: CircleUser },
  { href: "/settings?section=app", labelKey: "settings.sectionApp", icon: Monitor },
  { href: "/settings?section=printer", labelKey: "settings.printerTitle", icon: Printer, perm: "print" },
  { href: "/settings?section=storage", labelKey: "settings.externalSources", icon: Database, admin: true },
  { href: "/settings?section=ai", labelKey: "settings.sectionAI", icon: Sparkles, admin: true },
  { href: "/settings?section=backup", labelKey: "settings.sectionSystem", icon: Wrench, admin: true },
];
const navSections = [
  { id: "overview", labelKey: "nav.dashboard", icon: House, paths: ["/dashboard"] },
  { id: "inventory", labelKey: "nav.inventoryGroup", icon: Box, paths: primaryNav.filter((href) => href !== "/dashboard") },
  { id: "operations", labelKey: "nav.operationsGroup", icon: ArrowLeftRight, paths: operationsNav },
  { id: "system", labelKey: "nav.systemGroup", icon: Sparkles, paths: systemNav },
  { id: "settings", labelKey: "nav.settings", icon: Settings, paths: settingsNav },
] as const;

type NavSectionID = (typeof navSections)[number]["id"];

const sidebarFavoriteIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: House,
  items: Box,
  plus: Plus,
  categories: Tag,
  locations: MapPin,
  vendors: Building2,
  movements: ClipboardList,
  maintenance: CalendarDays,
  checkouts: ArrowLeftRight,
  chat: Sparkles,
  ai: BarChart3,
  users: Users,
  settings: Settings,
};

const defaultSidebarFavorites: SidebarFavorite[] = [
  { id: "items", label: "Items", icon: "items", href: "/items" },
];

function canAccessFavoriteHref(href: string, isAdmin: boolean, can: (perm: string) => boolean) {
  if (href === "/dashboard" || href === "/settings") return true;
  if (href === "/items/new") return isAdmin || can("items.write");
  if (href === "/items") return isAdmin || can("items.read");
  if (href === "/categories") return isAdmin || can("categories.read");
  if (href === "/locations") return isAdmin || can("locations.read");
  if (href === "/vendors") return isAdmin || can("vendors.read");
  if (href === "/inventory-checks") return isAdmin || can("inventory.read");
  if (href === "/inventory-movements") return isAdmin || can("inventory.read");
  if (href === "/maintenance") return isAdmin || can("maintenance.read");
  if (href === "/checkouts") return isAdmin || can("checkout.manage");
  if (href === "/chat" || href === "/ai-usage" || href === "/users") return isAdmin;
  return true;
}

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch={enableNavPrefetch}
      onClick={onClick}
      className={clsx(
        "group relative flex min-h-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border px-2 py-2 text-center text-xs font-semibold transition",
        active
          ? "border-gray-200 bg-white text-gray-900 shadow-xs dark:border-white/10 dark:bg-white/10 dark:text-white dark:shadow-none"
          : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-white hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white",
      )}
    >
      <span className={clsx("flex shrink-0 items-center", active ? "text-gray-900 dark:text-white" : "text-gray-400 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white")}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="max-w-full truncate">{label}</span>
      {badge ? (
        <span className="absolute inset-y-0 right-0 w-0.5 rounded-r-lg bg-orange-500 dark:bg-orange-400" />
      ) : null}
    </Link>
  );
}

function SidebarSectionTile({
  label,
  icon: Icon,
  active,
  disabled,
  badge,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  disabled?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={clsx(
        "group relative flex min-h-16 cursor-pointer select-none flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border px-2 py-2 text-center text-xs font-semibold transition",
        active
          ? "border-gray-200 bg-white text-gray-900 shadow-xs dark:border-white/10 dark:bg-white/10 dark:text-white dark:shadow-none"
          : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-white hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white",
        disabled && "cursor-not-allowed opacity-40 hover:bg-gray-50 hover:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-400",
      )}
    >
      <Icon className={clsx("h-5 w-5", active ? "text-gray-900 dark:text-white" : "text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white")} />
      <span className="max-w-full truncate">{label}</span>
      {badge ? (
        <span className="absolute inset-y-0 right-0 w-0.5 rounded-r-lg bg-orange-500 dark:bg-orange-400" />
      ) : null}
    </div>
  );
}

export function AppSidebar({
  pathname,
  realm,
  theme,
  isAdmin,
  badges,
  t,
  can,
  loadBadges,
  setSidebarOpen,
  setRealm,
  setTheme,
  routerPush,
  sidebarOpen,
  onLogout,
}: {
  pathname: string;
  realm: "archive" | "collection";
  theme: "light" | "dark" | "system";
  isAdmin: boolean;
  badges: Record<string, number>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  can: (perm: string) => boolean;
  loadBadges: () => Promise<void>;
  setSidebarOpen: (open: boolean) => void;
  setRealm: (realm: "archive" | "collection") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  routerPush: (href: string) => void;
  sidebarOpen: boolean;
  onLogout: () => Promise<void>;
}) {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const visibleNavItems = navItems.filter((item) => (item.admin ? isAdmin : !item.perm || can(item.perm)));
  const visibleSettingsNavItems = settingsNavItems.filter((item) => {
    if (item.admin) return isAdmin;
    if (item.perm) return isAdmin || can(item.perm);
    return true;
  }).sort((a, b) => t(a.labelKey).localeCompare(t(b.labelKey), undefined, { sensitivity: "base" }));
  const currentPathWithQuery = queryString ? `${pathname}?${queryString}` : pathname;
  const isActivePath = (href: string) => {
    const hrefPath = href.split("?")[0];
    if (href.includes("?")) return currentPathWithQuery === href;
    return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  };
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.id === "settings"
        ? visibleSettingsNavItems
        : section.paths
            .map((href) => visibleNavItems.find((item) => item.href === href))
            .filter((item): item is (typeof visibleNavItems)[number] => Boolean(item)),
    }))
    .filter((section) => section.id === "overview" || section.items.length > 0);
  const sectionForPath = visibleSections.find((section) => section.items.some((item) => isActivePath(item.href)))?.id || "overview";
  const [sidebarFavorites, setSidebarFavorites] = useState<SidebarFavorite[]>(defaultSidebarFavorites);
  const visibleSidebarFavorites = sidebarFavorites.filter((favorite) => canAccessFavoriteHref(favorite.href, isAdmin, can));
  const tabSectionId = visibleSidebarFavorites.some((favorite) => isActivePath(favorite.href))
    ? "overview"
    : sectionForPath;
  const sectionBadgeCount = (sectionId: NavSectionID) => {
    const section = visibleSections.find((entry) => entry.id === sectionId);
    if (!section) return 0;
    return section.items.reduce((sum, item) => sum + (badges[item.href] || 0), 0);
  };
  const selectedSectionIndex = Math.max(0, visibleSections.findIndex((section) => section.id === tabSectionId));
  const themeCycle: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
  const currentThemeIndex = themeCycle.indexOf(theme);
  const nextTheme = themeCycle[(currentThemeIndex + 1) % themeCycle.length];
  const themeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const ThemeIcon = themeIcon;
  const themeTitle = theme === "light" ? t("theme.light") : theme === "dark" ? t("theme.dark") : t("theme.system");
  const nextThemeTitle = nextTheme === "light" ? t("theme.light") : nextTheme === "dark" ? t("theme.dark") : t("theme.system");

  useEffect(() => {
    let active = true;
    const loadFavorites = () => {
      void api.getSidebarFavorites()
        .then((result) => {
          if (active) setSidebarFavorites(result.favorites || []);
        })
        .catch(() => {
          if (active) setSidebarFavorites(defaultSidebarFavorites);
        });
    };
    loadFavorites();
    window.addEventListener("sidebar-favorites-updated", loadFavorites);
    return () => {
      active = false;
      window.removeEventListener("sidebar-favorites-updated", loadFavorites);
    };
  }, []);

  const sidebarContent = (
    <>
      <div className="relative flex min-h-16 w-full flex-none items-start justify-between px-6 py-4 lg:items-center lg:justify-start">
        <Link prefetch={enableNavPrefetch} href="/dashboard" onClick={() => setSidebarOpen(false)} className="group inline-flex min-w-0 max-w-full items-start gap-3 text-lg font-semibold text-gray-900 dark:text-white lg:items-center">
          <LogoFull size={34} className="max-w-full" />
        </Link>
        <div className="pt-1 lg:hidden">
          <button type="button" onClick={() => setSidebarOpen(false)} className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <RadioGroup
          value={realm}
          onChange={(nextRealm: "archive" | "collection") => {
            setRealm(nextRealm);
            if (pathname.match(/\/items\/\d/)) routerPush("/items");
          }}
          className="mb-6 mt-2 flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5"
        >
          <Radio
            value="archive"
            className={clsx(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
              realm === "archive"
                ? "bg-white text-gray-900 shadow-xs dark:bg-white/10 dark:text-white dark:shadow-none"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
            )}
          >
            <Archive className="h-4 w-4" />
            <span>{t("realm.archive")}</span>
          </Radio>
          <Radio
            value="collection"
            className={clsx(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
              realm === "collection"
                ? "bg-white text-gray-900 shadow-xs dark:bg-white/10 dark:text-white dark:shadow-none"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
            )}
          >
            <Gem className="h-4 w-4" />
            <span>{t("realm.collection")}</span>
          </Radio>
        </RadioGroup>

        <TabGroup
          key={tabSectionId}
          defaultIndex={selectedSectionIndex}
          onChange={(index) => {
            const nextSection = visibleSections[index];
            if (!nextSection || nextSection.items.length === 0) return;
            if (nextSection.id === "overview") {
              routerPush("/dashboard");
              setSidebarOpen(false);
            }
          }}
        >
          <TabList className="mb-5 grid grid-cols-2 gap-2">
            {visibleSections.map((section) => (
              <Tab key={section.id} as={Fragment}>
                {({ selected }) => (
                  <div className="cursor-pointer select-none outline-none">
                    <SidebarSectionTile
                      label={t(section.labelKey)}
                      icon={section.icon}
                      active={selected}
                      disabled={section.items.length === 0}
                      badge={sectionBadgeCount(section.id)}
                      onClick={() => {
                        if (section.id === "overview" && pathname !== "/dashboard") {
                          routerPush("/dashboard");
                          setSidebarOpen(false);
                        }
                      }}
                    />
                  </div>
                )}
              </Tab>
            ))}
          </TabList>

          <TabPanels>
            {visibleSections.map((section) => (
              <TabPanel key={section.id} className="outline-hidden">
                {section.id !== "overview" ? (
                  <div className="text-xs/6 font-semibold text-gray-400 dark:text-gray-400">{t(section.labelKey)}</div>
                ) : null}
                {section.id === "overview" && visibleSidebarFavorites.length > 0 ? (
                  <>
                    <div className="text-xs/6 font-semibold text-gray-400 dark:text-gray-400">
                      {t("settings.sidebarFavoritesTitle")}
                    </div>
                    <nav className="mt-2 flex flex-1 flex-col">
                      <ul role="list" className="grid grid-cols-2 gap-2">
                        {visibleSidebarFavorites.map((favorite) => (
                          <li key={favorite.id}>
                            <SidebarNavLink
                              href={favorite.href}
                              label={favorite.label}
                              icon={sidebarFavoriteIcons[favorite.icon] || House}
                              active={isActivePath(favorite.href)}
                              badge={badges[favorite.href]}
                              onClick={() => {
                                setSidebarOpen(false);
                              }}
                            />
                          </li>
                        ))}
                      </ul>
                    </nav>
                  </>
                ) : null}
                {section.id !== "overview" ? (
                  <nav className="mt-2 flex flex-1 flex-col">
                    <ul role="list" className="grid grid-cols-2 gap-2">
                      {(section.items || []).map(({ href, labelKey, icon }) => (
                        <li key={href}>
                          <SidebarNavLink
                            href={href}
                            label={t(labelKey)}
                            icon={icon}
                            active={isActivePath(href)}
                            badge={badges[href]}
                            onClick={() => {
                              setSidebarOpen(false);
                              if (badges[href]) void loadBadges();
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </nav>
                ) : null}
              </TabPanel>
            ))}
          </TabPanels>
        </TabGroup>
      </div>

      <div className="flex min-h-[60px] flex-none items-center px-6 py-3">
        <div className="flex items-center justify-start gap-3">
          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            title={`${themeTitle} -> ${nextThemeTitle}`}
            aria-label={`${themeTitle} -> ${nextThemeTitle}`}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 transition hover:bg-blue-50 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-blue-500/10 dark:hover:text-white"
          >
            <ThemeIcon className="h-4 w-4" />
            <span className="sr-only">{themeTitle}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              void onLogout();
            }}
            title={t("nav.logout")}
            aria-label={t("nav.logout")}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 transition hover:bg-blue-50 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-blue-500/10 dark:hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">{t("nav.logout")}</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Transition show={sidebarOpen}>
        <Dialog onClose={setSidebarOpen} className="relative z-50 lg:hidden">
          <TransitionChild
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/30" />
          </TransitionChild>

          <div className="fixed inset-0 flex">
            <TransitionChild
              enter="transform transition ease-in-out duration-300"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in-out duration-300"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <DialogPanel className="relative mr-16 flex w-full max-w-72 flex-1">
                <nav
                  id="page-sidebar"
                  aria-label="Main Sidebar Navigation"
                  className="flex h-full w-full flex-col border-r border-gray-200 bg-white text-gray-700 dark:border-white/10 dark:bg-gray-900 dark:text-gray-200 dark:before:pointer-events-none dark:before:absolute dark:before:inset-0 dark:before:bg-black/10"
                >
                  {sidebarContent}
                </nav>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      <nav
        aria-label="Main Sidebar Navigation"
        className="hidden h-full w-72 flex-col border-r border-gray-200 bg-white text-gray-700 dark:border-white/10 dark:bg-gray-900 dark:text-gray-200 dark:before:pointer-events-none dark:before:absolute dark:before:inset-0 dark:before:bg-black/10 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex"
      >
        {sidebarContent}
      </nav>
    </>
  );
}
