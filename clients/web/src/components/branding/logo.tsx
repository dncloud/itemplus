"use client";

import type { CSSProperties } from "react";
import { useApp } from "@/lib/app-context";

export function BrandTitle({
  title,
  className,
  style,
}: {
  title: string;
  className?: string;
  style?: CSSProperties;
}) {
  const normalized = title.trim() || "item+";
  if (normalized === "item+") {
    return (
      <span className={className} style={style}>
        item<span style={{ color: "#e63947" }}>+</span>
      </span>
    );
  }
  return (
    <span className={className} style={style}>
      {normalized}
    </span>
  );
}

export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  const { brandingLogo, brandingTitle, brandingWidth, brandingLogoBackground, brandingLogoPadding, brandingLogoRadius } = useApp();
  if (brandingLogo) {
    return (
      <span
        className={`inline-flex items-center justify-center overflow-hidden ${className || ""}`}
        style={{
          borderRadius: brandingLogoRadius,
          padding: brandingLogoPadding,
          backgroundColor: brandingLogoBackground || undefined,
        }}
      >
        <img
          src={brandingLogo}
          alt={brandingTitle || "Site logo"}
          style={{
            width: Math.min(brandingWidth, size * 3),
            height: "auto",
            maxHeight: size * 1.5,
            borderRadius: brandingLogoRadius,
          }}
          className="block object-contain"
        />
      </span>
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
  const {
    brandingLogo,
    brandingTitle,
    brandingTitleSize,
    brandingTitlePosition,
    brandingSubtitle,
    brandingWidth,
    brandingLogoBackground,
    brandingLogoPadding,
    brandingLogoRadius,
  } = useApp();
  const title = brandingTitle.trim() || "item+";
  const titleFontSize = Math.max(12, brandingTitleSize || Math.round(size * 0.6));
  if (brandingLogo) {
    const stackTitle = brandingTitlePosition === "below";
    return (
      <div className={`min-w-0 ${stackTitle ? "" : "flex items-center gap-3"} ${className || ""}`}>
        <div
          className="inline-flex max-w-full shrink-0 overflow-hidden"
          style={{
            borderRadius: brandingLogoRadius,
            padding: brandingLogoPadding,
            backgroundColor: brandingLogoBackground || undefined,
          }}
        >
          <img
            src={brandingLogo}
            alt={title}
            style={{
              width: brandingWidth,
              maxWidth: "100%",
              height: "auto",
              borderRadius: brandingLogoRadius,
            }}
            className="block object-contain"
          />
        </div>
        <div className={`min-w-0 ${stackTitle ? "mt-2" : ""}`}>
          <BrandTitle
            title={title}
            className="block truncate font-semibold leading-none text-gray-900 dark:text-white"
            style={{ fontSize: titleFontSize }}
          />
          {brandingSubtitle.trim() ? (
            <div className={`${stackTitle ? "mt-2" : "mt-1"} text-[11px] leading-snug text-gray-500 dark:text-gray-400 whitespace-pre-line break-words`}>
              {brandingSubtitle}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2.5 ${className || ""}`}>
      <LogoIcon size={Math.round(size * 1.08)} className="shrink-0" />
      <div className="min-w-0">
        <BrandTitle title={title} className="block truncate font-bold leading-none" style={{ fontSize: titleFontSize }} />
        {brandingSubtitle.trim() ? (
          <div className="mt-1 text-[11px] leading-snug text-gray-500 dark:text-gray-400 whitespace-pre-line break-words">
            {brandingSubtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
