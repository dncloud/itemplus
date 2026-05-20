export function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function flashStatus(
  setStatus: (value: string | null) => void,
  message: string,
  timeoutMs = 2500,
) {
  setStatus(message);
  window.setTimeout(() => setStatus(null), timeoutMs);
}
