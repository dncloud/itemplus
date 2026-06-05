export function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function messageFromErrorCode(
  error: unknown,
  fallback: string,
  messages: Partial<Record<string, string>>,
) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && messages[code]) {
      return messages[code]!;
    }
  }
  return messageFromError(error, fallback);
}

export function flashStatus(
  setStatus: (value: string | null) => void,
  message: string,
  timeoutMs = 2500,
) {
  setStatus(message);
  window.setTimeout(() => setStatus(null), timeoutMs);
}
