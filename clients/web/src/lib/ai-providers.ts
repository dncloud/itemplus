// The AI providers item+ can talk to, in the order they are offered: the two
// hosted ones first, the local one last.
export type AIProvider = "openai" | "anthropic" | "ollama";

export const AI_PROVIDERS: AIProvider[] = ["openai", "anthropic", "ollama"];

/** The name a provider goes by in the interface. */
export function aiProviderLabel(provider: string): string {
  if (provider === "anthropic") return "Claude";
  if (provider === "ollama") return "Ollama";
  return "OpenAI";
}

/** A local Ollama needs no key and has no model list to load; the hosted providers have both. */
export function isHostedAIProvider(provider: string): boolean {
  return provider !== "ollama";
}
