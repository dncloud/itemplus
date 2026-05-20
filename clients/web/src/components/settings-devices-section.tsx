"use client";

import { DevicePhoneMobileIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { SettingsCard } from "@/components/settings-ui";

type SessionEntry = {
  id: number;
  device_type: string;
  device_name: string | null;
  ip_address: string | null;
  is_online: boolean;
  last_seen: string | null;
};

function formatSessionSubtitle(session: SessionEntry) {
  return [
    session.device_type === "ios" ? "iOS App" : "Browser",
    session.ip_address,
    session.last_seen ? new Date(session.last_seen).toLocaleString() : null,
  ].filter(Boolean).join(" · ");
}

export function SettingsDevicesSection({
  sessions,
  t,
  onRemove,
}: {
  sessions: SessionEntry[];
  t: (key: string, params?: Record<string, string | number>) => string;
  onRemove: (sessionId: number) => void;
}) {
  const online = sessions.filter((session) => session.is_online);
  const offline = sessions.filter((session) => !session.is_online);
  const display = [...online, ...offline.slice(0, Math.max(0, 5 - online.length))];

  if (display.length === 0) return null;

  return (
    <SettingsCard
      sectionId="devices"
      icon={DevicePhoneMobileIcon}
      title={t("settings.sectionDevices")}
      description={`${online.length} online · ${display.length} shown`}
    >
      <ul className="divide-y divide-gray-200 rounded-md bg-white/5 outline outline-1 -outline-offset-1 outline-gray-300 dark:divide-white/10 dark:outline-white/10">
        {display.map((session) => (
          <li key={session.id} className="flex items-center gap-3 p-4">
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${session.is_online ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.device_name || session.device_type}</p>
              <p className="text-xs text-gray-400">{formatSessionSubtitle(session)}</p>
            </div>
            <button
              onClick={async () => {
                await fetch(`${api.baseURL}/api/devices/sessions/${session.id}`, {
                  method: "DELETE",
                  credentials: "include",
                });
                onRemove(session.id);
              }}
              className="text-xs text-red-500 hover:text-red-600"
            >
              {t("common.remove")}
            </button>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}
