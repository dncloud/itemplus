import type { CSSProperties } from "react";
import clsx from "clsx";

type ChipTheme = "auto" | "light" | "dark";

// The colour of a category or location is chosen once and has to be readable
// on a light and on a dark page. So the chip never prints it as it is: on a
// light page the text is darkened, on a dark page it is lightened, and the
// background is a faint tint of the same colour.
const lightColored =
  "bg-[color-mix(in_oklab,var(--chip-color)_12%,transparent)] text-[color-mix(in_oklab,var(--chip-color)_55%,black)]";
const darkColored =
  "bg-[color-mix(in_oklab,var(--chip-color)_20%,transparent)] text-[color-mix(in_oklab,var(--chip-color)_55%,white)]";
const autoColored = `${lightColored} dark:bg-[color-mix(in_oklab,var(--chip-color)_20%,transparent)] dark:text-[color-mix(in_oklab,var(--chip-color)_55%,white)]`;

const plain: Record<ChipTheme, string> = {
  auto: "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300",
  light: "bg-gray-50 text-gray-600",
  dark: "bg-white/5 text-gray-300",
};

/**
 * A category or location name in its own colour. `theme` is only for the
 * preview in the forms, which shows both sides at once; everywhere else the
 * chip follows the page.
 */
export function ColorChip({ label, color, onClick, theme = "auto", className }: {
  label: string;
  color?: string | null;
  onClick?: () => void;
  theme?: ChipTheme;
  className?: string;
}) {
  const classes = clsx(
    "inline-flex max-w-full items-center rounded-md px-2 py-1 text-xs font-medium",
    color ? (theme === "light" ? lightColored : theme === "dark" ? darkColored : autoColored) : plain[theme],
    className,
  );
  const style = color ? ({ "--chip-color": color } as CSSProperties) : undefined;
  const text = <span className="truncate">{label}</span>;

  return onClick ? (
    <button type="button" onClick={onClick} className={classes} style={style}>{text}</button>
  ) : (
    <span className={classes} style={style}>{text}</span>
  );
}
