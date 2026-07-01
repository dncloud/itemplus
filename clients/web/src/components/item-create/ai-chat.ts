"use client";

export type AIChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  pending?: boolean;
  animate?: boolean;
};

export type AIChatSuggestion = {
  id: string;
  label: string;
  value: string;
  onApply: () => void;
};

export function createChatId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadTempImagePreview(tempImageID: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/ai/temp-image/${tempImageID}`, { credentials: "include" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Could not convert temp image"));
      };
      reader.onerror = () => reject(reader.error || new Error("Could not read temp image"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function buildConversationContext(history: AIChatEntry[], nextUserMessage: string) {
  const lines = history
    .filter((entry) => !entry.pending && entry.content.trim())
    .map((entry) => `${entry.role === "user" ? "User" : "Assistant"}: ${entry.content.trim()}`);
  if (nextUserMessage.trim()) {
    lines.push(`User: ${nextUserMessage.trim()}`);
  }
  return lines.join("\n");
}
