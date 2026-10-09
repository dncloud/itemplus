export function normalizePropertyValue(raw: unknown): unknown {
  let value = raw;
  for (let attempt = 0; attempt < 2 && typeof value === "string"; attempt++) {
    const text = value.trim();
    if (!text || text === "null") return null;
    if (!text.startsWith("[") && !text.startsWith("{") && !text.startsWith('"')) break;
    try { value = JSON.parse(text); } catch { break; }
  }
  if (Array.isArray(value)) {
    const entries = value.map(normalizePropertyValue).filter((entry) => entry != null);
    return entries.length ? entries : null;
  }
  if (value != null && typeof value === "object" && Object.keys(value).length === 0) return null;
  return value ?? null;
}
