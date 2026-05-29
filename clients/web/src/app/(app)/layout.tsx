"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SearchDialog from "@/components/search-dialog";
import { useApp } from "@/lib/app-context";
import { AppShellContainer, AppShellFooter, AppShellHeader, AppShellLoading, AppSidebarOverlay } from "@/app/(app)/app-shell";
import { AppSidebar } from "@/app/(app)/app-sidebar";
import {
  connectAppWebSocket,
  loadAppBadges,
  logoutAppSession,
  registerAppShellEvents,
  sendAppPresence,
  verifySessionOrRedirect,
} from "@/app/(app)/app-layout-utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { realm, setRealm, serverURL, theme, setTheme, ready, isAdmin, can, t, iosBridgeStatus, printerBridgeStatus, showPrintFeatures } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});

  const loadBadges = useCallback(async () => {
    setBadges(await loadAppBadges(can));
  }, [can]);

  useEffect(() => {
    if (!ready) return;

    void verifySessionOrRedirect(() => {
      router.replace("/auth");
    });
  }, [ready, router]);

  useEffect(() => {
    if (!ready) return;

    connectAppWebSocket(serverURL);

    return registerAppShellEvents({
      routerPush: (href) => router.push(href),
      routerReplace: (href) => router.replace(href),
      realm,
      setRealm,
      refreshBadges: () => {
        void loadBadges();
      },
    });
  }, [router, ready, loadBadges, realm, serverURL, setRealm]);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(loadBadges);
  }, [ready, loadBadges]);

  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(loadBadges, 30000);
    return () => clearInterval(interval);
  }, [ready, loadBadges]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!ready) {
    return <AppShellLoading />;
  }

  return (
    <AppShellContainer>
      <AppSidebarOverlay sidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
        setRealm={setRealm}
        setTheme={setTheme}
        logout={logoutAppSession}
        routerPush={(href) => router.push(href)}
        sidebarOpen={sidebarOpen}
      />

      <AppShellHeader
        t={t}
        iosBridgeStatus={iosBridgeStatus}
        printerBridgeStatus={printerBridgeStatus}
        showPrinterStatus={showPrintFeatures && (isAdmin || can("print"))}
        onOpenSidebar={() => setSidebarOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <main id="page-content" className="flex max-w-full flex-auto flex-col">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>

      <AppShellFooter />

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Suspense fallback={null}>
        <AppPresenceReporter ready={ready} pathname={pathname} realm={realm} />
      </Suspense>
    </AppShellContainer>
  );
}

function AppPresenceReporter({
  ready,
  pathname,
  realm,
}: {
  ready: boolean;
  pathname: string;
  realm: "archive" | "collection";
}) {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  useEffect(() => {
    if (!ready) return;
    sendAppPresence(pathname, queryString, realm);
  }, [ready, pathname, queryString, realm]);

  return null;
}
