"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Link2 } from "lucide-react";
import { api } from "@/lib/api";

type LinkSession = { token: string; value: string; expiresAt: number };

/** Lets a signed-in user attach an Apple ID by scanning a QR code with the item+ app. */
export function SettingsAppleLink({ t, linked, onLinked, buttonClass }: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  linked: boolean;
  onLinked: () => Promise<void>;
  buttonClass: string;
}) {
  const [session, setSession] = useState<LinkSession | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [justLinked, setJustLinked] = useState(false);

  const start = async () => {
    setBusy(true);
    setMessage("");
    try {
      const created = await api.createAppleLink();
      setRemaining(created.expires_in);
      setSession({ token: created.link_token, value: created.qr_value, expiresAt: Date.now() + created.expires_in * 1000 });
    } catch {
      setMessage(t("settings.appleLinkFailed"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    let active = true;
    let polling = false;

    const tick = window.setInterval(() => {
      const secondsLeft = Math.ceil((session.expiresAt - Date.now()) / 1000);
      if (secondsLeft <= 0) {
        setSession(null);
        setMessage(t("settings.appleLinkExpired"));
        return;
      }
      setRemaining(secondsLeft);
      if (polling || secondsLeft % 2 !== 0) return;
      polling = true;
      api.getAppleLinkStatus(session.token).then(({ status }) => {
        if (!active || status === "pending") return;
        setSession(null);
        if (status === "linked") {
          setJustLinked(true);
          void onLinked();
        } else {
          setMessage(t("settings.appleLinkExpired"));
        }
      }).catch(() => {}).finally(() => { polling = false; });
    }, 1000);

    return () => { active = false; window.clearInterval(tick); };
  }, [session, onLinked, t]);

  const isLinked = linked || justLinked;

  return (
    <div className="space-y-4 border-t border-gray-200 pt-8 dark:border-white/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm/6 font-semibold text-gray-900 dark:text-white">{t("settings.appleLinkTitle")}</h3>
          <p className="text-sm/6 text-gray-500 dark:text-gray-400">
            {isLinked ? t("settings.appleLinkConnected") : t("settings.appleLinkHint")}
          </p>
          {message && !isLinked ? <p className="text-sm/6 text-rose-600 dark:text-rose-400">{message}</p> : null}
        </div>
        {isLinked ? (
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
            <CircleCheck className="h-4 w-4" />
            {t("settings.appleLinkDone")}
          </span>
        ) : !session ? (
          <button type="button" onClick={() => void start()} disabled={busy} className={`${buttonClass} shrink-0 disabled:cursor-not-allowed disabled:opacity-50`}>
            <Link2 className="h-4 w-4" />
            {busy ? t("common.loading") : t("settings.appleLinkStart")}
          </button>
        ) : null}
      </div>

      {session && !isLinked ? (
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="rounded-xl bg-white p-4 outline outline-1 -outline-offset-1 outline-gray-200 dark:outline-white/10">
            <img src={`/api/print/qr/generate.svg?data=${encodeURIComponent(session.value)}`} alt="QR Code" className="h-40 w-40" />
          </div>
          <div className="space-y-2">
            <p className="max-w-sm text-sm/6 text-gray-500 dark:text-gray-400">{t("settings.appleLinkScanHint")}</p>
            <p className={`font-mono text-sm ${remaining < 30 ? "text-red-500" : "text-gray-400"}`}>
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
            </p>
            <button type="button" onClick={() => setSession(null)} className={buttonClass}>{t("common.cancel")}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
