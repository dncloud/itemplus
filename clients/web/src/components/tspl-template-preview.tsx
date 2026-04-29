"use client";

type PreviewElement =
  | { kind: "text"; x: number; y: number; rotate: number; xMul: number; yMul: number; content: string }
  | { kind: "box"; x: number; y: number; width: number; height: number; thickness: number }
  | { kind: "bar"; x: number; y: number; width: number; height: number }
  | { kind: "qrcode"; x: number; y: number; cellWidth: number; rotate: number; justification?: number; area?: number; content: string };

export type TSPLPreviewModel = {
  widthMM: number;
  heightMM: number;
  gapMM: number;
  speed: number;
  density: number;
  direction: 0 | 1;
  referenceX: number;
  referenceY: number;
  shiftX: number;
  shiftY: number;
  elements: PreviewElement[];
  commands: string[];
};

const DEFAULT_WIDTH_MM = 40;
const DEFAULT_HEIGHT_MM = 20;

export function parseTSPLPreview(tspl: string): TSPLPreviewModel {
  const lines = tspl.replaceAll("\r\n", "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  let widthMM = DEFAULT_WIDTH_MM;
  let heightMM = DEFAULT_HEIGHT_MM;
  let gapMM = 3;
  let speed = 4;
  let density = 8;
  let direction: 0 | 1 = 1;
  let referenceX = 0;
  let referenceY = 0;
  let shiftX = 0;
  let shiftY = 0;
  const commands: string[] = [];
  let elements: PreviewElement[] = [];

  for (const line of lines) {
    const command = line.split(/\s+/, 1)[0]?.toUpperCase() || "";
    commands.push(command);

    let match = line.match(/^SIZE\s+(\d+)\s*mm\s*,\s*(\d+)\s*mm$/i);
    if (match) {
      widthMM = Number(match[1]);
      heightMM = Number(match[2]);
      continue;
    }

    match = line.match(/^GAP\s+(\d+(?:\.\d+)?)\s*mm\s*,\s*(\d+(?:\.\d+)?)\s*mm$/i);
    if (match) {
      gapMM = Number(match[1]);
      continue;
    }

    match = line.match(/^SPEED\s+(\d+)$/i);
    if (match) {
      speed = Number(match[1]);
      continue;
    }

    match = line.match(/^DENSITY\s+(\d+)$/i);
    if (match) {
      density = Number(match[1]);
      continue;
    }

    match = line.match(/^DIRECTION\s+([01])(?:\s*,\s*[01])?$/i);
    if (match) {
      direction = Number(match[1]) as 0 | 1;
      continue;
    }

    match = line.match(/^REFERENCE\s+(-?\d+)\s*,\s*(-?\d+)$/i);
    if (match) {
      referenceX = Number(match[1]);
      referenceY = Number(match[2]);
      continue;
    }

    match = line.match(/^SHIFT\s+(?:(-?\d+)\s*,\s*)?(-?\d+)$/i);
    if (match) {
      shiftX = match[1] ? Number(match[1]) : 0;
      shiftY = Number(match[2]);
      continue;
    }

    if (/^CLS$/i.test(line)) {
      elements = [];
      continue;
    }

    match = line.match(/^TEXT\s+(-?\d+)\s*,\s*(-?\d+)\s*,\s*"[^"]*"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*"([\s\S]*)"$/i);
    if (match) {
      elements.push({
        kind: "text",
        x: Number(match[1]),
        y: Number(match[2]),
        rotate: Number(match[3]),
        xMul: Number(match[4]),
        yMul: Number(match[5]),
        content: match[6],
      });
      continue;
    }

    match = line.match(/^BOX\s+(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(\d+)/i);
    if (match) {
      const x1 = Number(match[1]);
      const y1 = Number(match[2]);
      const x2 = Number(match[3]);
      const y2 = Number(match[4]);
      elements.push({
        kind: "box",
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
        thickness: Number(match[5]),
      });
      continue;
    }

    match = line.match(/^BAR\s+(-?\d+)\s*,\s*(-?\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/i);
    if (match) {
      elements.push({
        kind: "bar",
        x: Number(match[1]),
        y: Number(match[2]),
        width: Number(match[3]),
        height: Number(match[4]),
      });
      continue;
    }

    const qrParsed = parseQRCodeLine(line);
    if (qrParsed) {
      elements.push({
        kind: "qrcode",
        ...qrParsed,
      });
      continue;
    }
  }

  return {
    widthMM,
    heightMM,
    gapMM,
    speed,
    density,
    direction,
    referenceX,
    referenceY,
    shiftX,
    shiftY,
    elements,
    commands,
  };
}

function parseQRCodeLine(line: string): Omit<Extract<PreviewElement, { kind: "qrcode" }>, "kind"> | null {
  const start = line.match(/^QRCODE\s+/i);
  if (!start) return null;

  const firstQuote = line.indexOf('"');
  const lastQuote = line.lastIndexOf('"');
  if (firstQuote === -1 || lastQuote <= firstQuote) return null;

  const prefix = line.slice(start[0].length, firstQuote).trim().replace(/,\s*$/, "");
  const content = line.slice(firstQuote + 1, lastQuote);
  const parts = prefix.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 6) return null;

  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const cellWidth = Number(parts[3]);
  const rotate = Number(parts[5]);
  if ([x, y, cellWidth, rotate].some((value) => Number.isNaN(value))) return null;

  let justification: number | undefined;
  let area: number | undefined;

  for (const part of parts.slice(6)) {
    const upper = part.toUpperCase();
    if (/^J[1-9]$/.test(upper)) {
      justification = Number(upper.slice(1));
      continue;
    }
    if (/^X\d+$/.test(upper)) {
      area = Number(upper.slice(1));
    }
  }

  return { x, y, cellWidth, rotate, justification, area, content };
}
