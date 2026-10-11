"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  CircleCheck,
  Mail,
  QrCode,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { BrandTitle, LogoIcon } from "@/components/branding/logo";
import { ServerUnreachableNotice } from "@/components/branding/server-unreachable";

export default function AuthPage() {
  const { t, ready, brandingTitle, brandingSubtitle, locale } = useApp();
  const [connected, setConnected] = useState(false);
  // Until the first health check has answered, nothing is known about the server.
  const [serverChecked, setServerChecked] = useState(false);

  const [authMode, setAuthMode] = useState<"qr" | "email">("qr");
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // QR state
  const [qrStatus, setQrStatus] = useState<"waiting" | "confirmed">("waiting");
  const [qrToken, setQrToken] = useState("");
  const [qrValue, setQrValue] = useState("");
  const [qrExpiry, setQrExpiry] = useState(0);
  const [qrExpired, setQrExpired] = useState(false);
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
    setServerChecked(true);
  };

  // Someone who is already signed in has no business on the sign-in page.
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    fetch("/api/user", { credentials: "include", cache: "no-store" })
      .then((res) => {
        if (res.ok && !cancelled) window.location.replace("/dashboard");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [connected]);

  // A phone cannot scan its own screen, so it starts on the e-mail tab.
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px), (pointer: coarse)").matches) setAuthMode("email");
  }, []);

  // The first QR code comes by itself. An expired one is only replaced on
  // request, so a forgotten tab does not keep asking the server for codes.
  useEffect(() => {
    if (connected && authMode === "qr" && !qrToken && !qrExpired && qrStatus !== "confirmed") requestQR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, authMode, qrToken, qrExpired]);

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
      setQrExpired(false);
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
            setQrExpired(true);
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
          setQrExpired(true);
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
        body: JSON.stringify({ email, locale }),
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
  const authPrimaryButtonClass = "flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500";
  const authTitle = brandingTitle.trim() || "item+";
  const authSubtitle = brandingSubtitle.trim() || "Inventory & Collection Management";
  const tabs = [
    { id: "qr" as const, label: t("auth.qrTab"), icon: QrCode },
    { id: "email" as const, label: t("auth.emailTab"), icon: Mail },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="space-y-3 text-center sm:mx-auto sm:w-full sm:max-w-md">
          <LogoIcon size={80} className="mx-auto" />
          <BrandTitle title={authTitle} className="block text-3xl font-bold" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{authSubtitle}</p>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
          <div className="bg-white px-6 pt-2 pb-10 shadow-sm sm:rounded-lg sm:px-12 dark:bg-gray-800/50 dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-white/10">
            {!serverChecked ? (
              <div className="flex justify-center pt-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            ) : !connected ? (
              <ServerUnreachableNotice />
            ) : (
              <div className="space-y-6">
                <div className="border-b border-gray-200 dark:border-white/10">
                  <nav aria-label={t("auth.title")} className="-mb-px flex">
                    {tabs.map((tab) => {
                      const current = authMode === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setAuthMode(tab.id)}
                          aria-current={current ? "page" : undefined}
                          className={clsx(
                            current
                              ? "border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-white/20 dark:hover:text-gray-300",
                            "group inline-flex flex-1 items-center justify-center border-b-2 px-1 py-4 text-sm font-medium",
                          )}
                        >
                          <tab.icon
                            aria-hidden="true"
                            className={clsx(
                              current
                                ? "text-indigo-500 dark:text-indigo-400"
                                : "text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400",
                              "mr-2 -ml-0.5 size-5",
                            )}
                          />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {authMode === "qr" ? (
                  <div className="space-y-4 text-center">
                    {qrStatus === "confirmed" ? (
                      <div className="space-y-3 py-6">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <CircleCheck className="h-8 w-8 text-green-600" />
                        </div>
                        <p className="text-sm font-medium text-green-600">{t("settings.connected")}</p>
                      </div>
                    ) : qrToken ? (
                      <>
                        <div className="inline-block rounded-xl bg-white p-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:outline-white/10">
                          <img
                            src={`/api/print/qr/generate.svg?data=${encodeURIComponent(qrValue)}`}
                            alt={t("auth.qrTab")}
                            className="h-48 w-48"
                          />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t("auth.scanQrHint")}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {t("auth.qrValidFor")}{" "}
                          <span className={clsx("font-mono", qrExpiry < 30 && "text-red-500")}>
                            {Math.floor(qrExpiry / 60)}:{String(qrExpiry % 60).padStart(2, "0")}
                          </span>
                        </p>
                      </>
                    ) : qrExpired ? (
                      <div className="space-y-4 py-6">
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t("auth.qrExpired")}</p>
                        <button type="button" onClick={requestQR} className={authPrimaryButtonClass}>
                          {t("auth.regenerateQr")}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="mx-auto inline-flex rounded-xl bg-white p-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:outline-white/10">
                          <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t("auth.scanQrHint")}</p>
                      </div>
                    )}
                  </div>
                ) : emailStatus === "sent" ? (
                  <div className="space-y-3 py-6 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                      <Mail className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t("auth.emailSent")}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("auth.emailSentHint")}</p>
                    <button type="button" onClick={() => setEmailStatus("idle")} className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                      {t("auth.useAnotherEmail")}
                    </button>
                  </div>
                ) : (
                  <form
                    className="space-y-6"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendMagicLink();
                    }}
                  >
                    <div>
                      <label htmlFor="auth-email" className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                        {t("auth.emailPlaceholder")}
                      </label>
                      <div className="mt-2">
                        <input
                          id="auth-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setEmailStatus("idle"); }}
                          placeholder={t("auth.emailExample")}
                          className={authInputClass}
                          autoFocus
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("auth.emailLoginHint")}</p>
                    </div>
                    <button type="submit" disabled={!email || emailStatus === "sending"} className={authPrimaryButtonClass}>
                      {emailStatus === "sending" ? t("auth.emailSending") : t("auth.sendMagicLink")}
                    </button>
                    {emailStatus === "error" ? (
                      <p className="text-center text-sm text-red-600 dark:text-red-400">{t("auth.emailSendFailed")}</p>
                    ) : null}
                  </form>
                )}
              </div>
            )}
          </div>

          {connected ? (
            <p className="mt-10 px-6 text-center text-sm/6 text-gray-500 dark:text-gray-400">{t("auth.newUserHint")}</p>
          ) : null}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-[11px] text-gray-400 dark:text-gray-600">
        <span className="whitespace-nowrap">&copy; 2025–2026 Oliver Cermann</span>
        <span aria-hidden="true">·</span>
        <a href="https://itemplus.app/imprint" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">Impressum</a>
        <span aria-hidden="true">·</span>
        <span className="whitespace-nowrap">MIT License</span>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/dncloud/itemplus" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">GitHub</a>
        <span aria-hidden="true">·</span>
        <a href="https://itemplus.app" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500">itemplus.app</a>
      </footer>
    </div>
  );
}
