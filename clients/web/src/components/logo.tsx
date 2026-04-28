"use client";

import { useApp } from "@/lib/app-context";

export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  const { brandingLogo, brandingWidth } = useApp();
  if (brandingLogo) {
    return (
      <img
        src={brandingLogo}
        alt="Site logo"
        style={{ width: Math.min(brandingWidth, size * 3), height: "auto", maxHeight: size * 1.5 }}
        className={`object-contain ${className || ""}`}
      />
    );
  }
  return (
    <img
      src="/logo.svg"
      alt="item+"
      width={size}
      height={size}
      className={`rounded-lg border border-gray-200 dark:border-transparent ${className || ""}`}
    />
  );
}

export function LogoFull({ size = 32, className }: { size?: number; className?: string }) {
  const { brandingLogo, brandingSubtitle, brandingWidth } = useApp();
  if (brandingLogo) {
    return (
      <div className={`min-w-0 ${className || ""}`}>
        <img
          src={brandingLogo}
          alt="Site logo"
          style={{ width: brandingWidth, height: "auto", maxWidth: "100%" }}
          className="object-contain"
        />
        {brandingSubtitle.trim() ? (
          <div className="mt-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400 whitespace-pre-line break-words">
            {brandingSubtitle}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2.5 ${className || ""}`}>
      <LogoIcon size={Math.round(size * 1.08)} className="shrink-0" />
      <div className="min-w-0">
        <div className="font-bold leading-none" style={{ fontSize: size * 0.6 }}>
          item<span style={{ color: "#e63947" }}>+</span>
        </div>
        {brandingSubtitle.trim() ? (
          <div className="mt-1 text-[11px] leading-snug text-gray-500 dark:text-gray-400 whitespace-pre-line break-words">
            {brandingSubtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
