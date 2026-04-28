"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import clsx from "clsx";
import {
  HomeIcon,
  CubeIcon,
  TagIcon,
  MapPinIcon,
  Cog6ToothIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
  ArchiveBoxIcon,
  SparklesIcon,
  ArrowsRightLeftIcon,
  BuildingOffice2Icon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import SearchDialog from "@/components/search-dialog";
import { LogoFull } from "@/components/logo";
import { wsClient } from "@/lib/ws";

const navItems = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: HomeIcon },
  { href: "/items", labelKey: "nav.items", icon: CubeIcon, perm: "items.read" },
  { href: "/categories", labelKey: "nav.categories", icon: TagIcon, perm: "categories.read" },
  { href: "/locations", labelKey: "nav.locations", icon: MapPinIcon, perm: "locations.read" },
  { href: "/vendors", labelKey: "nav.vendors", icon: BuildingOffice2Icon, perm: "vendors.read" },
  { href: "/checkouts", labelKey: "nav.checkouts", icon: ArrowsRightLeftIcon, perm: "checkout.manage" },
  { href: "/users", labelKey: "nav.users", icon: UsersIcon, admin: true },
];

function AppSidebar({
  pathname,
  realm,
  theme,
  isAdmin,
  badges,
  t,
  can,
  loadBadges,
  setSidebarOpen,
  setSearchOpen,
  setRealm,
  setTheme,
  logout,
  router,
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
  setSearchOpen: (open: boolean) => void;
  setRealm: (realm: "archive" | "collection") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  logout: () => Promise<void>;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="flex h-full flex-col gap-y-5 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-800 px-4 py-6">
      <Link href="/dashboard">
        <LogoFull size={30} />
      </Link>

      <div className="flex rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-1">
        <button
          onClick={() => { setRealm("archive"); if (pathname.match(/\/items\/\d/)) router.push("/items"); }}
          className={clsx(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
            realm === "archive"
              ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          )}
        >
          <ArchiveBoxIcon className="h-3.5 w-3.5" /> {t("realm.archive")}
        </button>
        <button
          onClick={() => { setRealm("collection"); if (pathname.match(/\/items\/\d/)) router.push("/items"); }}
          className={clsx(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
            realm === "collection"
              ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          )}
        >
          <SparklesIcon className="h-3.5 w-3.5" /> {t("realm.collection")}
        </button>
      </div>

      <div className="flex rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-1">
        {([
          { key: "light" as const, icon: SunIcon, label: t("theme.light") },
          { key: "dark" as const, icon: MoonIcon, label: t("theme.dark") },
          { key: "system" as const, icon: ComputerDesktopIcon, label: t("theme.system") },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTheme(key)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition",
              theme === key
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
            title={label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      <button
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
        <MagnifyingGlassIcon className="h-4 w-4" />
        <span className="flex-1 text-left">{t("common.search")}</span>
        <kbd className="hidden sm:inline-flex text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5">⌘K</kbd>
      </button>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.filter((n) => (n.admin ? isAdmin : !n.perm || can(n.perm))).map(({ href, labelKey, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => { setSidebarOpen(false); if (badges[href]) void loadBadges(); }}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              pathname === href
                ? "bg-blue-50 dark:bg-blue-400/10 text-blue-600 dark:text-blue-200"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="flex-1">{t(labelKey)}</span>
            {badges[href] > 0 && (
              <span className="bg-blue-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                {badges[href]}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="space-y-1">
        <Link
          href="/settings"
          className={clsx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
            pathname === "/settings"
              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          )}
        >
          <Cog6ToothIcon className="h-5 w-5" /> {t("nav.settings")}
        </Link>
        <button
          onClick={() => void logout()}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { realm, setRealm, theme, setTheme, ready, isAdmin, can, t } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});

  const loadBadges = useCallback(async () => {
    const b: Record<string, number> = {};
    try {
      if (can("users.manage")) {
        const users = await api.getInactiveUsers().catch(() => []);
        if (users.length > 0) b["/users"] = users.length;
      }
      if (can("checkout.manage")) {
        const reqs = await api.getCheckoutRequests().catch(() => []);
        const pending = reqs.filter((r: { status: string }) => r.status === "pending").length;
        if (pending > 0) b["/checkouts"] = pending;
      }
    } catch {}
    setBadges(b);
  }, [can]);

  useEffect(() => {
    if (!ready) return;

    // Check auth by trying to fetch user — if 401, redirect to login
    api.getMe().catch(() => { router.replace("/auth"); return; });

    // Connect WebSocket (singleton — stays connected across route changes)
    const wsURL = window.location.origin;
    if (wsURL) {
      wsClient.connect(wsURL);
    }

    // Listen for cross-device events
    const unsub1 = wsClient.on("browser.open_item", (data) => {
      const itemId = Number(data.item_id);
      if (Number.isFinite(itemId) && itemId > 0) router.push(`/items/${itemId}`);
    });

    const unsub2 = wsClient.on("browser.open_location", (data) => {
      const locationId = Number(data.location_id);
      const r = data.realm as string;
      if (r === "archive" || r === "collection") { if (r !== realm) setRealm(r); }
      if (Number.isFinite(locationId) && locationId > 0) router.push(`/items?location=${locationId}`);
    });

    // If this session gets kicked → logout
    const unsub3 = wsClient.on("session.kicked", async () => {
      wsClient.disconnect();
      try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch {}
      router.replace("/auth");
    });

    // Refresh badges on any relevant event
    const refreshBadges = () => loadBadges();
    const unsub4 = wsClient.on("admin.checkout_requested", refreshBadges);
    const unsub5 = wsClient.on("admin.new_user_registered", refreshBadges);
    const unsub6 = wsClient.on("checkout.approved", refreshBadges);
    const unsub7 = wsClient.on("checkout.rejected", refreshBadges);
    const unsub8 = wsClient.on("user.activated", refreshBadges);
    const unsub9 = wsClient.on("delete.done", refreshBadges);

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsub8(); unsub9(); };
  }, [router, ready, loadBadges, realm, setRealm]);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(loadBadges);
  }, [ready, loadBadges]);

  // Refresh badges every 30s (not on every navigation — too many requests)
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(loadBadges, 30000);
    return () => clearInterval(interval);
  }, [ready, loadBadges]);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch {}
    wsClient.disconnect();
    window.location.href = "/auth";
  };

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64">
            <AppSidebar
              pathname={pathname}
              realm={realm}
              theme={theme}
              isAdmin={isAdmin}
              badges={badges}
              t={t}
              can={can}
              loadBadges={loadBadges}
              setSidebarOpen={setSidebarOpen}
              setSearchOpen={setSearchOpen}
              setRealm={setRealm}
              setTheme={setTheme}
              logout={logout}
              router={router}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <AppSidebar
          pathname={pathname}
          realm={realm}
          theme={theme}
          isAdmin={isAdmin}
          badges={badges}
          t={t}
          can={can}
          loadBadges={loadBadges}
          setSidebarOpen={setSidebarOpen}
          setSearchOpen={setSearchOpen}
          setRealm={setRealm}
          setTheme={setTheme}
          logout={logout}
          router={router}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 lg:pl-64">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur px-4 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Bars3Icon className="h-6 w-6" />
          </button>
          <LogoFull size={22} />
        </div>

        <main className="p-6 lg:p-8">{children}</main>
      </div>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
