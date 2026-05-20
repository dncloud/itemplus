"use client";

import Link from "next/link";
import clsx from "clsx";
import {
  ArchiveBoxIcon,
  ArrowsRightLeftIcon,
  BuildingOffice2Icon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  CubeIcon,
  HomeIcon,
  MapPinIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
  TagIcon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { LogoFull } from "@/components/logo";

const enableNavPrefetch = process.env.NODE_ENV === "production";

const navItems = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: HomeIcon },
  { href: "/items", labelKey: "nav.items", icon: CubeIcon, perm: "items.read" },
  { href: "/categories", labelKey: "nav.categories", icon: TagIcon, perm: "categories.read" },
  { href: "/locations", labelKey: "nav.locations", icon: MapPinIcon, perm: "locations.read" },
  { href: "/vendors", labelKey: "nav.vendors", icon: BuildingOffice2Icon, perm: "vendors.read" },
  { href: "/checkouts", labelKey: "nav.checkouts", icon: ArrowsRightLeftIcon, perm: "checkout.manage" },
  { href: "/users", labelKey: "nav.users", icon: UsersIcon, admin: true },
];

const primaryNav = ["/dashboard", "/items", "/categories", "/locations", "/vendors"];
const secondaryNav = ["/checkouts", "/users"];

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
        "group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold",
        active
          ? "bg-gray-50 text-indigo-600 dark:bg-white/5 dark:text-white"
          : "text-gray-700 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white",
      )}
    >
      <span className={clsx("flex shrink-0 items-center", active ? "text-indigo-600 dark:text-white" : "text-gray-400 group-hover:text-indigo-600 dark:text-gray-400 dark:group-hover:text-white")}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="truncate">{label}</span>
      {badge ? (
        <span className="ml-auto inline-flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[11px]/5 font-semibold text-white dark:bg-indigo-500">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
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
  logout,
  routerPush,
  sidebarOpen,
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
  logout: () => Promise<void>;
  routerPush: (href: string) => void;
  sidebarOpen: boolean;
}) {
  const visibleNavItems = navItems.filter((item) => (item.admin ? isAdmin : !item.perm || can(item.perm)));
  const mainNavItems = visibleNavItems.filter((item) => primaryNav.includes(item.href));
  const adminNavItems = visibleNavItems.filter((item) => secondaryNav.includes(item.href));
  const isActivePath = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      id="page-sidebar"
      aria-label="Main Sidebar Navigation"
      className={clsx(
        "fixed inset-y-0 left-0 z-50 flex h-full w-full flex-col border-r border-gray-200 bg-white text-gray-700 transition-transform duration-300 ease-in-out dark:border-r-0 dark:bg-gray-900 dark:text-gray-200 dark:ring-1 dark:ring-white/10 dark:before:pointer-events-none dark:before:absolute dark:before:inset-0 dark:before:bg-black/10 lg:w-72",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0",
      )}
    >
      <div className="relative flex min-h-16 w-full flex-none items-start justify-between px-6 py-4 lg:items-center lg:justify-start">
        <Link prefetch={enableNavPrefetch} href="/dashboard" onClick={() => setSidebarOpen(false)} className="group inline-flex min-w-0 max-w-full items-start gap-3 text-lg font-semibold text-gray-900 dark:text-white lg:items-center">
          <LogoFull size={28} className="max-w-full" />
        </Link>
        <div className="pt-1 lg:hidden">
          <button type="button" onClick={() => setSidebarOpen(false)} className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto px-6 pb-4">
        <div className="mb-5 flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5">
          <button
            onClick={() => {
              setRealm("archive");
              if (pathname.match(/\/items\/\d/)) routerPush("/items");
            }}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs/6 font-semibold transition",
              realm === "archive"
                ? "bg-white text-gray-900 shadow-xs dark:bg-white/10 dark:text-white dark:shadow-none"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
            )}
          >
            <ArchiveBoxIcon className="h-3.5 w-3.5" />
            <span>{t("realm.archive")}</span>
          </button>
          <button
            onClick={() => {
              setRealm("collection");
              if (pathname.match(/\/items\/\d/)) routerPush("/items");
            }}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs/6 font-semibold transition",
              realm === "collection"
                ? "bg-white text-gray-900 shadow-xs dark:bg-white/10 dark:text-white dark:shadow-none"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
            )}
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            <span>{t("realm.collection")}</span>
          </button>
        </div>

        <div className="mb-6 flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5">
          {([
            { key: "light" as const, icon: SunIcon, label: t("theme.light") },
            { key: "dark" as const, icon: MoonIcon, label: t("theme.dark") },
            { key: "system" as const, icon: ComputerDesktopIcon, label: t("theme.system") },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              title={label}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs/6 font-semibold transition",
                theme === key
                  ? "bg-white text-gray-900 shadow-xs dark:bg-white/10 dark:text-white dark:shadow-none"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <div className="text-xs/6 font-semibold text-gray-400 dark:text-gray-400">Overview</div>
        <nav className="mt-2 flex flex-1 flex-col">
          <ul role="list" className="-mx-2 space-y-1">
            {mainNavItems.map(({ href, labelKey, icon }) => (
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

          {adminNavItems.length > 0 ? (
            <>
              <div className="pt-6 text-xs/6 font-semibold text-gray-400 dark:text-gray-400">Manage</div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                {adminNavItems.map(({ href, labelKey, icon }) => (
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
            </>
          ) : null}

          <div className="pt-6 text-xs/6 font-semibold text-gray-400 dark:text-gray-400">Account</div>
          <ul role="list" className="-mx-2 mt-2 space-y-1">
            <li>
              <SidebarNavLink
                href="/settings"
                label={t("nav.settings")}
                icon={Cog6ToothIcon}
                active={pathname === "/settings"}
                onClick={() => setSidebarOpen(false)}
              />
            </li>
            <li className="mt-auto">
              <button
                onClick={() => void logout()}
                className="group flex w-full gap-x-3 rounded-md p-2 text-left text-sm/6 font-semibold text-gray-700 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <span className="flex shrink-0 items-center text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-white">
                  <UserCircleIcon className="h-5 w-5" />
                </span>
                <span className="truncate">{t("nav.logout")}</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </nav>
  );
}
