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
            setTimeout(() => { window.location.href = "/dashboard"; }, 800);
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
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
              <button
                onClick={() => setAuthMode("qr")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  authMode === "qr" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM17 14.625v2.25m0 2.25v-2.25m0 0h2.25m-2.25 0h-2.25" />
                </svg>
                QR-Code
              </button>
              <button
                onClick={() => setAuthMode("email")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  authMode === "email" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                E-Mail
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
                    <div className="bg-white p-4 rounded-xl inline-block shadow-sm">
                      <img
                        src={`/api/print/qr/generate.svg?data=${encodeURIComponent(qrValue)}`}
                        alt="QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                    <p className="text-xs text-gray-500">Scanne den QR-Code mit der item+ App</p>
                    <div className="text-sm text-gray-400">
                      <span className={`font-mono ${qrExpiry < 30 ? "text-red-500" : ""}`}>
                        {Math.floor(qrExpiry / 60)}:{String(qrExpiry % 60).padStart(2, "0")}
                      </span>
                      {qrExpiry <= 0 && (
                        <button onClick={requestQR} className="ml-2 text-blue-500 hover:text-blue-600 font-medium">
                          Neu generieren
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
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
                    <p className="text-sm font-medium">E-Mail gesendet!</p>
                    <p className="text-xs text-gray-500">Prüfe dein Postfach und klicke auf den Link in der E-Mail.</p>
                    <button onClick={() => setEmailStatus("idle")} className="text-xs text-gray-400 hover:text-gray-600">
                      Andere E-Mail verwenden
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailStatus("idle"); }}
                      onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                      placeholder="E-Mail-Adresse"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={sendMagicLink}
                      disabled={!email || emailStatus === "sending"}
                      className="w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition"
                    >
                      {emailStatus === "sending" ? "Wird gesendet..." : "Magic Link senden"}
                    </button>
                    {emailStatus === "error" && (
                      <p className="text-xs text-red-500 text-center">E-Mail konnte nicht gesendet werden</p>
                    )}
                    <p className="text-xs text-gray-400 text-center">Du erhältst einen Link per E-Mail mit dem du dich anmelden kannst.</p>
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
