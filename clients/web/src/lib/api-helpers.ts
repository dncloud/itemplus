import type { AIParseStreamEvent } from "@/lib/api";

export function buildQueryString(values: Record<string, string | number | boolean | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function parseApiError(res: Response) {
  const err = await res.json().catch(() => ({}));
  return new Error(err.detail || `HTTP ${res.status}`);
}

export function buildSingleFileForm(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

export function buildRecoverBackupForm(
  file: File,
  options: { database: boolean; attachments: boolean; config: boolean },
) {
  const form = buildSingleFileForm(file);
  form.append("confirm", "RECOVER");
  form.append("restore_database", options.database ? "1" : "0");
  form.append("restore_uploads", options.attachments ? "1" : "0");
  form.append("restore_config", options.config ? "1" : "0");
  return form;
}

export async function readEventStream(
  res: Response,
  onEvent: (event: AIParseStreamEvent) => void,
) {
  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const idx = buffer.indexOf("\n\n");
      if (idx < 0) break;
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      for (const line of frame.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        try {
          onEvent(JSON.parse(payload) as AIParseStreamEvent);
        } catch {
          // ignore malformed chunks
        }
      }
    }
  }
}
