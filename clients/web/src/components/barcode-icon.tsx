"use client";

export function BarcodeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M3 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 5v14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.5 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 5v14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14.5 5v14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M18 5v14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M21 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
