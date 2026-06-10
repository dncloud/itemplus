"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon, PlusIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useApp } from "@/lib/app-context";
import { api, type AIChatMessage, type AIChatStreamEvent, type AIProfile, type AIUsage } from "@/lib/api";
import { MarkdownView } from "@/components/markdown";

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  pending?: boolean;
  revealed?: boolean;
};

type ChatViewTab = "chat" | "raw";

const CHAT_SESSION_STORAGE_KEY = "itemplus_chat_session_v1";

function createChatId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function AnimatedWordText({
  text,
  animate,
  onFinished,
}: {
  text: string;
  animate: boolean;
  onFinished?: () => void;
}) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const wordCount = useMemo(() => tokens.filter((token) => token.trim().length > 0).length, [tokens]);
  const [visibleWords, setVisibleWords] = useState(animate ? 0 : wordCount);

  useEffect(() => {
    if (!animate) {
      return;
    }
    let count = 0;
    const timer = window.setInterval(() => {
      count = Math.min(wordCount, count + 1);
      setVisibleWords(count);
      if (count >= wordCount) {
        window.clearInterval(timer);
        onFinished?.();
      }
    }, 85);
    return () => window.clearInterval(timer);
  }, [animate, text, wordCount, onFinished]);

  let consumedWords = 0;
  const visibleTokens: string[] = [];
  let activeWord: string | null = null;
  for (const token of tokens) {
    if (token.trim().length === 0) {
      if (consumedWords > 0 && consumedWords <= visibleWords) {
        visibleTokens.push(token);
      }
      continue;
    }
    if (consumedWords >= visibleWords) {
      if (animate && activeWord === null) activeWord = token;
      break;
    }
    visibleTokens.push(token);
    consumedWords += 1;
  }

  return (
    <span className="whitespace-pre-wrap">
      {visibleTokens.join("")}
      {activeWord ? <span className="ai-word-reveal">{activeWord}</span> : null}
    </span>
  );
}

function AssistantMessageContent({
  content,
  animate,
  onFinished,
}: {
  content: string;
  animate: boolean;
  onFinished?: () => void;
}) {
  if (animate) {
    return <AnimatedWordText text={content} animate onFinished={onFinished} />;
  }
  return (
    <MarkdownView
      content={content}
      className="[&>:first-child]:mt-0 [&>:last-child]:mb-0"
    />
  );
}

export default function ChatPage() {
  const { locale, t, currentUserLabel } = useApp();
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [activeProfile, setActiveProfile] = useState<AIProfile | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [activeTab, setActiveTab] = useState<ChatViewTab>("chat");
  const [composer, setComposer] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [allowWebSearch, setAllowWebSearch] = useState(true);
  const [rawDebugLog, setRawDebugLog] = useState("");
  const [lastUsage, setLastUsage] = useState<AIUsage | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ tempImageId: string; previewUrl: string; fileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const rawScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        messages?: ChatEntry[];
        activeTab?: ChatViewTab;
        composer?: string;
        allowWebSearch?: boolean;
        rawDebugLog?: string;
        lastUsage?: AIUsage | null;
      };
      if (Array.isArray(parsed.messages)) {
        setMessages(
          parsed.messages.map((message) =>
            message.role === "assistant" && !message.pending ? { ...message, revealed: true } : message,
          ),
        );
      }
      if (parsed.activeTab === "chat" || parsed.activeTab === "raw") setActiveTab(parsed.activeTab);
      if (typeof parsed.composer === "string") setComposer(parsed.composer);
      if (typeof parsed.allowWebSearch === "boolean") setAllowWebSearch(parsed.allowWebSearch);
      if (typeof parsed.rawDebugLog === "string") setRawDebugLog(parsed.rawDebugLog);
      if (parsed.lastUsage && typeof parsed.lastUsage === "object") setLastUsage(parsed.lastUsage);
    } catch {
      // ignore broken session cache
    }
  }, []);

  useEffect(() => {
    void api.getAISettings()
      .then((settings) => {
        const profile = settings.profiles.find((entry) => entry.id === settings.active_profile_id) || settings.profiles[0] || null;
        setActiveProfile(profile);
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        CHAT_SESSION_STORAGE_KEY,
        JSON.stringify({
          messages,
          activeTab,
          composer,
          allowWebSearch,
          rawDebugLog,
          lastUsage,
        }),
      );
    } catch {
      // ignore session cache failures
    }
  }, [messages, activeTab, composer, allowWebSearch, rawDebugLog, lastUsage]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [composer]);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const container = rawScrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [rawDebugLog]);

  const modelBadge = useMemo(() => {
    if (!activeProfile) return null;
    return `${activeProfile.provider === "ollama" ? "Ollama" : "OpenAI"} · ${activeProfile.model}`;
  }, [activeProfile]);
  const userLabel = currentUserLabel || t("chat.you");

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    try {
      setStatus(null);
      const response = await fetch("/api/ai/temp-image", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error.detail as string | undefined) || t("chat.uploadFailed"));
      }
      const data = (await response.json()) as { temp_image_id: string };
      setPendingUpload({
        tempImageId: data.temp_image_id,
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("chat.uploadFailed"));
    }
  };

  const handleSend = async () => {
    const trimmed = composer.trim();
    if (!trimmed && !pendingUpload) return;

    const userMessageText = trimmed || t("chat.imageOnlyPrompt");
    const userEntry: ChatEntry = {
      id: createChatId("chat-user"),
      role: "user",
      content: userMessageText,
      imageUrl: pendingUpload?.previewUrl,
      revealed: true,
    };
    const assistantEntryId = createChatId("chat-assistant");
    setMessages((current) => [
      ...current,
      userEntry,
      { id: assistantEntryId, role: "assistant", content: t("categories.aiThinking"), pending: true },
    ]);
    setComposer("");
    setBusy(true);
    setStatus(null);

    const chatPayloadMessages: AIChatMessage[] = [...messages, userEntry].map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));
    const tempImageID = pendingUpload?.tempImageId;
    setPendingUpload(null);

    let streamedText = "";
    try {
      await api.chatWithAIStream(
        {
          messages: chatPayloadMessages,
          locale,
          allow_web_search: allowWebSearch,
          temp_image_id: tempImageID,
        },
        (event: AIChatStreamEvent) => {
          if (event.type === "delta" && event.delta) {
            streamedText += event.delta;
          }
          if (event.type === "raw" && event.message) {
            setRawDebugLog((current) => `${current}${current ? "\n" : ""}${event.message}`);
          }
          if (event.type === "error" && event.message) {
            throw new Error(event.message);
          }
          if (event.type === "done") {
            const finalText = event.result?.assistant_message?.trim() || streamedText.trim() || t("chat.noReply");
            setLastUsage(event.result?.usage || null);
            setMessages((current) =>
              current.map((entry) =>
                entry.id === assistantEntryId ? { ...entry, content: finalText, pending: false, revealed: false } : entry,
              ),
            );
          }
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("chat.sendFailed");
      setStatus(message);
      setMessages((current) =>
        current.map((entry) =>
          entry.id === assistantEntryId ? { ...entry, content: message, pending: false, revealed: true } : entry,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!busy) void handleSend();
    }
  };

  const handleEndSession = () => {
    setMessages([]);
    setComposer("");
    setPendingUpload(null);
    setStatus(null);
    setAllowWebSearch(true);
    setRawDebugLog("");
    setLastUsage(null);
    try {
      window.sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
    } catch {
      // ignore session cache failures
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col space-y-6">
      <div className="text-center sm:border-b sm:border-gray-200 sm:text-left dark:border-gray-700">
        <div className="space-y-1">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-30">
                <ChevronRightIcon className="h-4 w-4" />
              </li>
              <li>{t("chat.title")}</li>
            </ol>
          </nav>
          <div className="py-3 sm:flex sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("chat.title")}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={clsx(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              activeTab === "chat"
                ? "bg-blue-500 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10",
            )}
          >
            {t("chat.tabConversation")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("raw")}
            className={clsx(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              activeTab === "raw"
                ? "bg-blue-500 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10",
            )}
          >
            {t("chat.tabRawDebug")}
          </button>
        </div>

        {activeTab === "chat" ? (
          <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <div className="space-y-5 pb-2">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                  {t("chat.empty")}
                </div>
              ) : null}
              {messages.map((message) => (
                <div key={message.id} className={clsx("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={clsx("max-w-[85%] space-y-2", message.role === "user" ? "items-end" : "items-start")}>
                    <p className="px-1 text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                      {message.role === "user" ? userLabel : t("chat.assistantName")}
                    </p>
                    <div
                      className={clsx(
                        "rounded-2xl px-4 py-3 text-sm",
                        message.role === "user"
                          ? "bg-blue-500 text-white"
                          : "border border-gray-200 bg-gray-50 text-gray-800 dark:border-white/10 dark:bg-white/5 dark:text-gray-200",
                      )}
                    >
                      {message.imageUrl ? (
                        <img
                          src={message.imageUrl}
                          alt=""
                          className="mb-3 max-h-56 w-auto rounded-xl border border-gray-200 object-cover dark:border-white/10"
                        />
                      ) : null}
                      {message.pending ? (
                        <p className="ai-thinking-text font-semibold text-gray-900 dark:text-white">{message.content}</p>
                      ) : message.role === "assistant" ? (
                        <AssistantMessageContent
                          content={message.content}
                          animate={!message.revealed}
                          onFinished={() =>
                            setMessages((current) =>
                              current.map((entry) =>
                                entry.id === message.id ? { ...entry, revealed: true } : entry,
                              ),
                            )
                          }
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div ref={rawScrollRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            {rawDebugLog ? (
              <pre className="overflow-x-auto rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-xs leading-6 text-gray-800 whitespace-pre-wrap dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                {rawDebugLog}
              </pre>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                {t("chat.rawEmpty")}
              </div>
            )}
          </div>
        )}

        <div className="shrink-0">
          {pendingUpload ? (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
              <img src={pendingUpload.previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{pendingUpload.fileName}</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingUpload(null)}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                {t("common.remove")}
              </button>
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-gray-950/20">
            <textarea
              ref={composerRef}
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={1}
              className="min-h-[44px] w-full resize-none overflow-hidden bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500 dark:text-white"
            />
            <div className="mt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                  {modelBadge || t("common.loading")}
                </span>
                {lastUsage?.total_tokens ? (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    {t("chat.usageTotal", { count: lastUsage.total_tokens })}
                  </span>
                ) : null}
                {lastUsage?.input_tokens ? (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    {t("chat.usageInput", { count: lastUsage.input_tokens })}
                  </span>
                ) : null}
                {lastUsage?.output_tokens ? (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    {t("chat.usageOutput", { count: lastUsage.output_tokens })}
                  </span>
                ) : null}
                {lastUsage?.reasoning_tokens ? (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                    {t("chat.usageReasoning", { count: lastUsage.reasoning_tokens })}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  <PlusIcon className="h-4 w-4" />
                  {t("chat.attach")}
                </button>
                <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={allowWebSearch}
                    onChange={(e) => setAllowWebSearch(e.target.checked)}
                    className="accent-blue-500"
                  />
                  {t("chat.allowWebSearch")}
                </label>
                <button
                  type="button"
                  onClick={handleEndSession}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  {t("chat.endSession")}
                </button>
                {status ? <span className="text-sm text-amber-300">{status}</span> : null}
              </div>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={busy || (!composer.trim() && !pendingUpload)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
                {t("common.send")}
              </button>
            </div>
          </div>
        </div>

        {!settingsLoaded ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("common.loading")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
