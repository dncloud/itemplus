"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SearchDialog from "@/components/search/dialog";
import { api, type UpdateStatus } from "@/lib/api";
import { SESSION_UNAUTHORIZED_EVENT } from "@/lib/api-helpers";
import { useApp } from "@/lib/app-context";
import { AppShellContainer, AppShellFooter, AppShellHeader, AppShellLoading } from "@/app/(app)/app-shell";
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
  const { realm, setRealm, serverURL, theme, setTheme, ready, isAdmin, can, t, iosBridgeStatus, printerBridgeStatus, aiAssistantBusy, aiAssistantPanelAvailable, aiAssistantPanelOpen, toggleAiAssistantPanel, showPrintFeatures } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  const loadBadges = useCallback(async () => {
    setBadges(await loadAppBadges(can, realm));
  }, [can, realm]);

  const loadUpdateStatus = useCallback(async () => {
    try {
      setUpdateStatus(await api.getUpdateStatus());
    } catch {
      setUpdateStatus(null);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;

    void verifySessionOrRedirect(() => {
      router.replace("/auth");
    });
  }, [ready, router]);

  useEffect(() => {
    if (!ready) return;

    let handled = false;
    const handleUnauthorized = () => {
      if (handled) return;
      handled = true;
      void logoutAppSession();
    };

    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(SESSION_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [ready]);

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
    void Promise.resolve().then(loadUpdateStatus);
    const interval = setInterval(loadUpdateStatus, 60000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadUpdateStatus();
      }
    };
    window.addEventListener("focus", loadUpdateStatus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", loadUpdateStatus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [ready, loadUpdateStatus]);

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
      <Suspense fallback={null}>
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
          routerPush={(href) => router.push(href)}
          sidebarOpen={sidebarOpen}
          onLogout={logoutAppSession}
        />
      </Suspense>

      <AppShellHeader
        t={t}
        iosBridgeStatus={iosBridgeStatus}
        printerBridgeStatus={printerBridgeStatus}
        aiAssistantBusy={aiAssistantBusy}
        aiAssistantPanelAvailable={aiAssistantPanelAvailable}
        aiAssistantPanelOpen={aiAssistantPanelOpen}
        onToggleAiAssistant={toggleAiAssistantPanel}
        showPrinterStatus={showPrintFeatures && (isAdmin || can("print"))}
        onOpenSidebar={() => setSidebarOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        updateStatus={updateStatus}
      />

      <main id="page-content" className="flex max-w-full flex-auto flex-col">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>

      <AppShellFooter
        serverVersion={
          updateStatus?.installed_version
            ? `${updateStatus.installed_version}${updateStatus.installed_build ? ` build ${updateStatus.installed_build}` : ""}`
            : null
        }
      />

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
