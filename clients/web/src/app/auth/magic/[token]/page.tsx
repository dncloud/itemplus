"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LogoIcon } from "@/components/logo";
import { useApp } from "@/lib/app-context";

export default function MagicLinkVerifyPage() {
  const { token } = useParams();
  const router = useRouter();
  const { t } = useApp();
  const [status, setStatus] = useState<"verifying" | "success" | "inactive" | "error">("verifying");

  useEffect(() => {
    const tokenValue = Array.isArray(token) ? token[0] : token;
    if (!tokenValue) return;

    const storageKey = `itemplus_magic_verify_started:${tokenValue}`;
    if (typeof window !== "undefined") {
      if (window.sessionStorage.getItem(storageKey) === "1") return;
      window.sessionStorage.setItem(storageKey, "1");
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/magic/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: tokenValue }),
        });
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = await res.json();
        if (!data.is_active) {
          setStatus("inactive");
          return;
        }
        setStatus("success");
        setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
      } catch {
        setStatus("error");
      }
    })();
  }, [token, router]);

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <LogoIcon size={64} className="mx-auto" />

        {status === "verifying" && (
          <div className="space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
            <p className="text-sm text-gray-500">{t("auth.verifying")}</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-green-600">{t("auth.success")}</p>
          </div>
        )}

        {status === "inactive" && (
          <div className="space-y-3">
            <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
              <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm font-medium">{t("auth.activationSuccess")}</p>
            <p className="text-xs text-gray-500">{t("auth.activationPending")}</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-600">{t("auth.invalidMagicLink")}</p>
            <button onClick={() => router.push("/auth")} className="text-xs text-gray-400 hover:text-gray-600">
              {t("auth.backToSignIn")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
