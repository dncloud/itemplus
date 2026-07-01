"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleAlert, CircleX } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { LogoIcon } from "@/components/branding/logo";
import { useApp } from "@/lib/app-context";

export default function MagicLinkVerifyPage() {
  const { token } = useParams();
  const router = useRouter();
  const { t } = useApp();
  const [status, setStatus] = useState<"verifying" | "success" | "inactive" | "error">("verifying");

  useEffect(() => {
    const tokenValue = Array.isArray(token) ? token[0] : token;
    if (!tokenValue) return;

    const verifyTimer = window.setTimeout(() => {
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
          window.setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
        } catch {
          setStatus("error");
        }
      })();
    }, 0);

    return () => {
      window.clearTimeout(verifyTimer);
    };
  }, [token]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-900 px-4 text-gray-100">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-3">
          <LogoIcon size={64} className="mx-auto" />
          <div className="text-2xl font-bold">
            item<span className="text-red-400">+</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-800/80 px-6 py-8 shadow-2xl shadow-black/20">

          {status === "verifying" && (
            <div className="space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-900/80 ring-1 ring-white/10">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
              <p suppressHydrationWarning className="text-sm text-gray-400">{t("auth.verifying")}</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CircleCheck className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-400">{t("auth.success")}</p>
            </div>
          )}

          {status === "inactive" && (
            <div className="space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <CircleAlert className="h-8 w-8 text-amber-600" />
              </div>
              <p className="text-sm font-medium">{t("auth.activationSuccess")}</p>
              <p className="text-xs text-gray-400">{t("auth.activationPending")}</p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <CircleX className="h-8 w-8 text-red-600" />
              </div>
              <p className="text-sm font-medium text-red-400">{t("auth.invalidMagicLink")}</p>
              <button onClick={() => router.push("/auth")} className="text-xs text-gray-400 hover:text-gray-200">
                {t("auth.backToSignIn")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
