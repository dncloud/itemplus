"use client";

import { useMemo } from "react";

const EAN_L_CODES = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];

const EAN_G_CODES = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];

const EAN_R_CODES = [
  "1110010",
  "1100110",
  "1101100",
  "1000010",
  "1011100",
  "1001110",
  "1010000",
  "1000100",
  "1001000",
  "1110100",
];

const EAN13_PARITY = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];

function encodeEAN8(digits: string) {
  const left = digits
    .slice(0, 4)
    .split("")
    .map((digit) => EAN_L_CODES[Number(digit)])
    .join("");
  const right = digits
    .slice(4)
    .split("")
    .map((digit) => EAN_R_CODES[Number(digit)])
    .join("");
  return `101${left}01010${right}101`;
}

function encodeEAN13(digits: string) {
  const first = Number(digits[0]);
  const parity = EAN13_PARITY[first];
  const left = digits
    .slice(1, 7)
    .split("")
    .map((digit, index) =>
      parity[index] === "L" ? EAN_L_CODES[Number(digit)] : EAN_G_CODES[Number(digit)],
    )
    .join("");
  const right = digits
    .slice(7)
    .split("")
    .map((digit) => EAN_R_CODES[Number(digit)])
    .join("");
  return `101${left}01010${right}101`;
}

export function BarcodePreview({ code, symbology }: { code: string; symbology?: string | null }) {
  const normalizedSymbology = (symbology || "").toLowerCase();
  const digits = code.replace(/\D/g, "");

  const bars = useMemo(() => {
    if ((normalizedSymbology.includes("ean-8") || normalizedSymbology.includes("ean8")) && digits.length === 8) {
      return encodeEAN8(digits);
    }
    if ((normalizedSymbology.includes("ean-13") || normalizedSymbology.includes("ean13")) && digits.length === 13) {
      return encodeEAN13(digits);
    }
    return null;
  }, [digits, normalizedSymbology]);

  if (!bars) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
        {code}
      </div>
    );
  }

  const modules = bars.length;
  const barWidth = 2;
  const width = modules * barWidth;
  const height = 56;
  const quietZone = 8;

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
      <svg
        width={width + quietZone * 2}
        height={height + 18}
        viewBox={`0 0 ${width + quietZone * 2} ${height + 18}`}
        aria-label={`Barcode ${code}`}
        className="block"
      >
        <rect x="0" y="0" width={width + quietZone * 2} height={height + 18} fill="transparent" />
        {bars.split("").map((bar, index) =>
          bar === "1" ? (
            <rect
              key={index}
              x={quietZone + index * barWidth}
              y={0}
              width={barWidth}
              height={height}
              fill="currentColor"
              className="text-gray-900 dark:text-white"
            />
          ) : null,
        )}
        <text
          x={(width + quietZone * 2) / 2}
          y={height + 12}
          textAnchor="middle"
          className="fill-gray-500 text-[10px] dark:fill-gray-400"
        >
          {code}
        </text>
      </svg>
    </div>
  );
}
