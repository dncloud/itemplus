"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { LogoIcon } from "@/components/logo";

export default function AuthPage() {
  const { t, ready } = useApp();
  const [connected, setConnected] = useState(false);

  const [authMode, setAuthMode] = useState<"qr" | "email">("qr");
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // QR state
  const [qrStatus, setQrStatus] = useState<"waiting" | "confirmed">("waiting");
  const [qrToken, setQrToken] = useState("");
  const [qrValue, setQrValue] = useState("");
  const [qrExpiry, setQrExpiry] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-connect
  useEffect(() => {
    if (!ready) return;
    tryConnect();
    const interval = setInterval(tryConnect, 5000);
    return () => clearInterval(interval);
  }, [ready]);

  const tryConnect = async () => {
    try {
      const res = await api.health();
      setConnected(res.app === "itemplus");
    } catch {
      setConnected(false);
    }
  };

  // Auto-request QR when connected
  useEffect(() => {
    if (connected && !qrToken && qrStatus !== "confirmed") requestQR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, qrToken]);

  const waitForBrowserSession = async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const res = await fetch("/api/user", { credentials: "include", cache: "no-store" });
        if (res.ok) return true;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  };

  const requestQR = async () => {
    try {
      const res = await fetch("/api/login/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQrToken(data.qr_token);
      setQrValue(data.qr_value);
      setQrExpiry(data.expires_in);
      setQrStatus("waiting");

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const check = await fetch(`/api/login/qr/${data.qr_token}/status`, { credentials: "include" });
          const result = await check.json();
          if (result.status === "confirmed") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            setQrStatus("confirmed");
            const sessionReady = await waitForBrowserSession();
            if (sessionReady) {
              window.location.href = "/dashboard";
            } else {
              setQrStatus("waiting");
              setQrToken("");
            }
          } else if (result.status === "expired") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            setQrToken("");
          }
        } catch {}
      }, 2000);

      if (countdownRef.current) clearInterval(countdownRef.current);
      let remaining = data.expires_in;
      countdownRef.current = setInterval(() => {
        remaining--;
        setQrExpiry(remaining);
        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (pollRef.current) clearInterval(pollRef.current);
          setQrToken("");
        }
      }, 1000);
    } catch {}
  };

  const sendMagicLink = async () => {
    if (!email) return;
    setEmailStatus("sending");
    try {
      const res = await fetch("/api/auth/magic/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setEmailStatus(res.ok ? "sent" : "error");
    } catch {
      setEmailStatus("error");
    }
  };

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const authInputClass = "block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500";
  const authPrimaryButtonClass = "flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm/6 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500";

  return (
    <div className="flex min-h-full items-start justify-center px-4 pt-[15vh]">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-3">
          <LogoIcon size={80} className="mx-auto" />
          <div className="text-3xl font-bold">
            item<span className="text-red-400">+</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Inventory & Collection Management</p>
        </div>

        {/* Login Methods */}
        {connected && (
          <div className="space-y-4 pt-2">
            {/* Tabs */}
            <div className="flex rounded-lg bg-white p-1 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-white/5 dark:outline-white/10">
              <button
                onClick={() => setAuthMode("qr")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm/6 font-semibold transition ${
                  authMode === "qr"
                    ? "bg-gray-50 text-gray-900 shadow-xs dark:bg-white/10 dark:text-white dark:shadow-none"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM17 14.625v2.25m0 2.25v-2.25m0 0h2.25m-2.25 0h-2.25" />
                </svg>
                {t("auth.qrTab")}
              </button>
              <button
                onClick={() => setAuthMode("email")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm/6 font-semibold transition ${
                  authMode === "email"
                    ? "bg-gray-50 text-gray-900 shadow-xs dark:bg-white/10 dark:text-white dark:shadow-none"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                {t("auth.emailTab")}
              </button>
            </div>

            {/* QR Login */}
            {authMode === "qr" && (
              <div className="text-center space-y-4">
                {qrStatus === "confirmed" ? (
                  <div className="py-6 space-y-3">
                    <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                      <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-green-600">{t("settings.connected")}!</p>
                  </div>
                ) : qrToken ? (
                  <>
                    <div className="inline-block rounded-xl bg-white p-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-white dark:outline-white/10">
                      <img
                        src={`/api/print/qr/generate.svg?data=${encodeURIComponent(qrValue)}`}
                        alt="QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                    <p className="text-xs text-gray-500">{t("auth.scanQrHint")}</p>
                    <div className="text-sm/6 text-gray-400">
                      <span className={`font-mono ${qrExpiry < 30 ? "text-red-500" : ""}`}>
                        {Math.floor(qrExpiry / 60)}:{String(qrExpiry % 60).padStart(2, "0")}
                      </span>
                      {qrExpiry <= 0 && (
                        <button onClick={requestQR} className="ml-2 font-semibold text-indigo-500 hover:text-indigo-400">
                          {t("auth.regenerateQr")}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 py-2">
                    <div className="mx-auto inline-flex rounded-xl bg-white p-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-white dark:outline-white/10">
                      <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">{t("auth.scanQrHint")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Magic Link */}
            {authMode === "email" && (
              <div className="space-y-4">
                {emailStatus === "sent" ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
                      <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium">{t("auth.emailSent")}</p>
                    <p className="text-xs text-gray-500">{t("auth.emailSentHint")}</p>
                    <button onClick={() => setEmailStatus("idle")} className="text-xs text-gray-400 hover:text-gray-600">
                      {t("auth.useAnotherEmail")}
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm/6 font-medium text-gray-900 dark:text-white">{t("auth.emailPlaceholder")}</label>
                      <div className="mt-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailStatus("idle"); }}
                      onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                      placeholder={t("auth.emailPlaceholder")}
                      className={authInputClass}
                      autoFocus
                    />
                      </div>
                    </div>
                    <button
                      onClick={sendMagicLink}
                      disabled={!email || emailStatus === "sending"}
                      className={authPrimaryButtonClass}
                    >
                      {emailStatus === "sending" ? t("auth.emailSending") : t("auth.sendMagicLink")}
                    </button>
                    {emailStatus === "error" && (
                      <p className="text-xs text-red-500 text-center">{t("auth.emailSendFailed")}</p>
                    )}
                    <p className="text-xs text-gray-400 text-center">{t("auth.emailLoginHint")}</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 text-center py-4 text-[11px] text-gray-400 dark:text-gray-600 space-x-3">
        <span>&copy; 2025–2026 Oliver Cermann</span>
        <span>·</span>
        <a href="https://itemplus.app/imprint" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">Impressum</a>
        <span>·</span>
        <span>MIT License</span>
        <span>·</span>
        <a href="https://github.com/dncloud/itemplus" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">GitHub</a>
        <span>·</span>
        <a href="https://itemplus.app" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">itemplus.app</a>
      </div>
    </div>
  );
}
