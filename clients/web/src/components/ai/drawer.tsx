"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { AIUsage } from "@/lib/api";
import { MarkdownView } from "@/components/ui/markdown";

export type AIDrawerTab = "chat" | "raw";

export type AIStatusDetails = {
  title: string;
  body?: string;
  actionLabel?: string;
} | null;

export type AIErrorInsights = {
  reason: string;
  description: string;
  questions: string[];
  notes: string[];
} | null;

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
  }, [animate, wordCount, onFinished]);

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
      if (animate && activeWord === null) {
        activeWord = token;
      }
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

function AssistantMarkdownMessage({
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

export function AIDrawerChatMessage({
  role,
  name,
  content,
  imageUrl,
  pending = false,
  animate = false,
  onAnimationDone,
}: {
  role: "user" | "assistant";
  name: string;
  content: string;
  imageUrl?: string;
  pending?: boolean;
  animate?: boolean;
  onAnimationDone?: () => void;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] space-y-2 ${isUser ? "items-end" : "items-start"}`}>
        <p className="px-1 text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">{name}</p>
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? "bg-blue-500 text-white"
              : "border border-gray-200 bg-gray-50 text-gray-800 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
          }`}
        >
          {isUser ? (
            <div className="space-y-3">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="max-h-56 w-auto rounded-xl border border-gray-200 object-cover dark:border-white/10"
                />
              ) : null}
              {content ? <p className="whitespace-pre-wrap">{content}</p> : null}
            </div>
          ) : pending ? (
            <p className="ai-thinking-text font-semibold text-gray-900 dark:text-white">{content}</p>
          ) : (
            <AssistantMarkdownMessage content={content} animate={animate} onFinished={onAnimationDone} />
          )}
        </div>
      </div>
    </div>
  );
}

export function AIInfoDrawer({
  open,
  onClose,
  title,
  subtitle,
  bodyClassName,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-none absolute inset-0 pl-10 focus:outline-none sm:pl-16">
        <div className="ml-auto flex h-full w-full max-w-2xl">
          <div className="pointer-events-auto relative flex h-full w-full flex-col overflow-y-auto bg-gray-800 py-6 shadow-2xl ring-1 ring-white/10">
            <div className="px-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">{title}</h2>
                  {subtitle ? <p className="mt-1 text-sm text-gray-400">{subtitle}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="relative rounded-md text-gray-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <span className="absolute -inset-2.5" />
                  <span className="sr-only">Close panel</span>
                  <X className="size-6" />
                </button>
              </div>
            </div>
            <div className={bodyClassName || "relative mt-6 flex-1 space-y-6 px-4 sm:px-6"}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIDrawerTabs({
  t,
  activeTab,
  onChange,
}: {
  t: (key: string) => string;
  activeTab: AIDrawerTab;
  onChange: (tab: AIDrawerTab) => void;
}) {
  const tabClass = (tab: AIDrawerTab) =>
    activeTab === tab
      ? "bg-blue-500 text-white"
      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10";

  return (
    <div className="flex items-center gap-2 px-1">
      <button
        type="button"
        onClick={() => onChange("chat")}
        className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${tabClass("chat")}`}
      >
        {t("chat.tabConversation")}
      </button>
      <button
        type="button"
        onClick={() => onChange("raw")}
        className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${tabClass("raw")}`}
      >
        {t("chat.tabRawDebug")}
      </button>
    </div>
  );
}

export function AIUsageBadges({
  t,
  modelBadge,
  usage,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  modelBadge: string | null;
  usage?: AIUsage | null;
}) {
  const badgeClass =
    "inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={badgeClass}>{modelBadge || t("common.loading")}</span>
      {usage?.total_tokens ? <span className={badgeClass}>{t("chat.usageTotal", { count: usage.total_tokens })}</span> : null}
      {usage?.input_tokens ? <span className={badgeClass}>{t("chat.usageInput", { count: usage.input_tokens })}</span> : null}
      {usage?.output_tokens ? <span className={badgeClass}>{t("chat.usageOutput", { count: usage.output_tokens })}</span> : null}
      {usage?.reasoning_tokens ? <span className={badgeClass}>{t("chat.usageReasoning", { count: usage.reasoning_tokens })}</span> : null}
    </div>
  );
}

export function AIRawDebugPanel({
  t,
  rawDebug,
}: {
  t: (key: string) => string;
  rawDebug: string;
}) {
  if (!rawDebug.trim()) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
        {t("chat.rawEmpty")}
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-xs leading-6 text-gray-800 whitespace-pre-wrap dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
      {rawDebug}
    </pre>
  );
}
