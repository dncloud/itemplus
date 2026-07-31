"use client";

export default function ColorPreviewBadge({
  color,
  label,
}: {
  color?: string | null;
  label: string;
}) {
  if (!color) return null;

  return (
    <span
      className="inline-flex h-8 items-center rounded-full border px-4 text-sm font-medium"
      style={{
        borderColor: color,
        backgroundColor: `${color}15`,
        color,
      }}
    >
      {label}
    </span>
  );
}
