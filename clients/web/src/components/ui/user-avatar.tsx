"use client";

import clsx from "clsx";

function initialsFromName(name?: string | null) {
  const value = (name || "").trim();
  if (!value) return "?";
  const parts = value.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || value.slice(0, 1).toUpperCase();
}

export function UserAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-20 w-20 text-xl" : "h-10 w-10 text-sm";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || "User avatar"}
        className={clsx("rounded-full object-cover outline outline-1 -outline-offset-1 outline-gray-200 dark:outline-white/10", sizeClass, className)}
      />
    );
  }

  return (
    <div
      className={clsx(
        "flex items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-600 outline outline-1 -outline-offset-1 outline-gray-200 dark:bg-white/5 dark:text-gray-300 dark:outline-white/10",
        sizeClass,
        className,
      )}
    >
      {initialsFromName(name)}
    </div>
  );
}
