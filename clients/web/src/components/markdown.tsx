"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { useApp } from "@/lib/app-context";

const MARKDOWN_VIEW_CLASS = `prose prose-sm dark:prose-invert max-w-none
  prose-headings:text-base prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
  prose-p:my-1.5 prose-p:leading-relaxed
  prose-a:text-blue-500 prose-a:no-underline hover:prose-a:underline
  prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
  prose-code:text-xs prose-code:bg-gray-100 prose-code:dark:bg-gray-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
  prose-pre:bg-gray-50 prose-pre:dark:bg-gray-900 prose-pre:rounded-lg prose-pre:text-xs
  prose-blockquote:border-l-blue-400 prose-blockquote:text-gray-500
  prose-strong:font-semibold prose-img:rounded-lg`;

// ── Markdown Renderer ──

export function MarkdownView({ content, className = "" }: { content: string; className?: string }) {
  if (!content) return null;
  return (
    <div className={`${MARKDOWN_VIEW_CLASS} ${className}`.trim()}>
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
    </div>
  );
}

// ── Markdown Editor with Toolbar ──

const TOOLBAR = [
  { icon: "B", label: "Bold", prefix: "**", suffix: "**" },
  { icon: "I", label: "Italic", prefix: "_", suffix: "_" },
  { icon: "~", label: "Strikethrough", prefix: "~~", suffix: "~~" },
  { icon: "</>", label: "Code", prefix: "`", suffix: "`" },
  { icon: "H", label: "Heading", prefix: "### ", suffix: "" },
  { icon: "—", label: "Divider", prefix: "\n---\n", suffix: "" },
  { icon: "•", label: "List", prefix: "- ", suffix: "" },
  { icon: "1.", label: "Ordered", prefix: "1. ", suffix: "" },
  { icon: "link", label: "Link", prefix: "[", suffix: "](url)" },
];

function ToolbarIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "B":
      return <span className="text-[13px] font-semibold leading-none">B</span>;
    case "I":
      return <span className="text-[13px] italic leading-none">I</span>;
    case "~":
      return <span className="text-[13px] leading-none line-through">S</span>;
    case "</>":
      return <span className="text-[11px] font-medium leading-none">&lt;/&gt;</span>;
    case "H":
      return <span className="text-[13px] font-semibold leading-none">H</span>;
    case "—":
      return <span className="text-[13px] leading-none">—</span>;
    case "•":
      return <span className="text-[13px] leading-none">•</span>;
    case "1.":
      return <span className="text-[11px] font-medium leading-none">1.</span>;
    case "link":
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-4">
          <path d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" fillRule="evenodd" />
        </svg>
      );
    default:
      return <span className="text-[13px] leading-none">{icon}</span>;
  }
}

function insertMarkdownSnippet(value: string, start: number, end: number, prefix: string, suffix: string) {
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);
  const placeholder = selected ? "" : suffix ? "text" : "";
  return {
    nextValue: before + prefix + (selected || placeholder) + suffix + after,
    selectionStart: start + prefix.length,
    selectionEnd: selected ? end + prefix.length : start + prefix.length + placeholder.length,
  };
}

export function MarkdownEditor({ value, onChange, placeholder, rows = 5 }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const { t } = useApp();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const resizeTextarea = () => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  };

  useEffect(() => {
    if (!preview) resizeTextarea();
  }, [preview, value]);

  const insert = (prefix: string, suffix: string) => {
    const ta = ref.current;
    if (!ta) return;
    const { nextValue, selectionStart, selectionEnd } = insertMarkdownSnippet(
      value,
      ta.selectionStart,
      ta.selectionEnd,
      prefix,
      suffix,
    );
    onChange(nextValue);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(selectionStart, selectionEnd);
    }, 0);
  };

  return (
    <div className="overflow-hidden rounded-md bg-white outline-1 -outline-offset-1 outline-gray-300 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-indigo-600 dark:bg-white/5 dark:outline-white/10 dark:focus-within:outline-indigo-500">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
        {TOOLBAR.map((btn) => (
          <button
            key={btn.label}
            type="button"
            title={btn.label}
            onClick={() => insert(btn.prefix, btn.suffix)}
            className="inline-flex size-8 items-center justify-center rounded text-gray-500 transition hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ToolbarIcon icon={btn.icon} />
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPreview(!preview)}
          className={`rounded px-2.5 py-1 text-xs transition ${preview ? "bg-gray-200 text-gray-900 dark:bg-white/10 dark:text-white" : "text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"}`}
        >
          {preview ? t("common.editor") : t("common.preview")}
        </button>
      </div>

      {/* Content */}
      {preview ? (
        <div className="min-h-[100px] bg-white px-3 py-2 dark:bg-transparent">
          {value ? <MarkdownView content={value} /> : <p className="text-sm italic text-gray-400">{t("common.noPreview")}</p>}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            resizeTextarea();
          }}
          placeholder={placeholder}
          rows={rows}
          className="block min-h-[80px] w-full resize-none overflow-hidden bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:bg-transparent dark:text-white dark:placeholder:text-gray-500"
        />
      )}
    </div>
  );
}
