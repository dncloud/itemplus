"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

// ── Markdown Renderer ──

export function MarkdownView({ content }: { content: string }) {
  if (!content) return null;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
      prose-headings:text-base prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
      prose-p:my-1.5 prose-p:leading-relaxed
      prose-a:text-blue-500 prose-a:no-underline hover:prose-a:underline
      prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
      prose-code:text-xs prose-code:bg-gray-100 prose-code:dark:bg-gray-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
      prose-pre:bg-gray-50 prose-pre:dark:bg-gray-900 prose-pre:rounded-lg prose-pre:text-xs
      prose-blockquote:border-l-blue-400 prose-blockquote:text-gray-500
      prose-strong:font-semibold prose-img:rounded-lg"
    >
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
  { icon: "🔗", label: "Link", prefix: "[", suffix: "](url)" },
];

export function MarkdownEditor({ value, onChange, placeholder, rows = 5 }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const insert = (prefix: string, suffix: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);

    if (selected) {
      // Wrap selection
      const newVal = before + prefix + selected + suffix + after;
      onChange(newVal);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
    } else {
      // Insert at cursor
      const placeholder = suffix ? "text" : "";
      const newVal = before + prefix + placeholder + suffix + after;
      onChange(newVal);
      setTimeout(() => {
        ta.focus();
        const pos = start + prefix.length;
        ta.setSelectionRange(pos, pos + placeholder.length);
      }, 0);
    }
  };

  return (
    <div className="rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        {TOOLBAR.map((btn) => (
          <button
            key={btn.label}
            type="button"
            title={btn.label}
            onClick={() => insert(btn.prefix, btn.suffix)}
            className="px-2 py-1 text-xs font-mono text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
          >
            {btn.icon}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPreview(!preview)}
          className={`px-2.5 py-1 text-xs rounded transition ${preview ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          {preview ? "Editor" : "Vorschau"}
        </button>
      </div>

      {/* Content */}
      {preview ? (
        <div className="px-3 py-2 min-h-[100px] bg-white dark:bg-gray-900">
          {value ? <MarkdownView content={value} /> : <p className="text-sm text-gray-400 italic">Keine Vorschau</p>}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none resize-y min-h-[80px] block"
        />
      )}
    </div>
  );
}
