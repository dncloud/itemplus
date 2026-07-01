export type AIChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  animate?: boolean;
};

export function createAIChatId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
