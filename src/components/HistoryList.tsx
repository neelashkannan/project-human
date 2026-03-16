"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "./AuthProvider";

interface Conversion {
  _id: Id<"conversions">;
  originalText: string;
  humanizedText: string;
  tone: string;
  createdAt: number;
}

const TONE_EMOJI: Record<string, string> = {
  casual: "💬",
  professional: "💼",
  academic: "🎓",
  creative: "🎨",
};

export default function HistoryList() {
  const { user } = useAuth();
  const conversions = useQuery(api.conversions.getRecent, { userId: user?.uid }) as Conversion[] | undefined;
  const removeConversion = useMutation(api.conversions.remove);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRemove = async (id: Id<"conversions">) => {
    if (!user?.uid) return;
    setRemovingId(id);
    // Wait for fade-out animation
    setTimeout(async () => {
      await removeConversion({ id, userId: user.uid });
      setRemovingId(null);
    }, 300);
  };

  if (conversions === undefined) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 animate-shimmer h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (conversions.length === 0) {
    return (
      <div className="text-center py-12 animate-blur-in">
        <div className="text-4xl mb-3 animate-float">✨</div>
        <p className="text-[var(--text-muted)]">
          No conversions yet. Humanize some text to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversions.map((item, index) => (
        <div
          key={item._id}
          className={`card overflow-hidden transition-all duration-300 ${
            removingId === item._id ? "opacity-0 scale-95 -translate-x-4" : ""
          }`}
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          <button
            onClick={() => setExpandedId(expandedId === item._id ? null : item._id)}
            className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-[var(--surface-2)] transition-all duration-200"
          >
            <div className="min-w-0 flex-1 flex items-center gap-3">
              <span className="text-lg shrink-0">{TONE_EMOJI[item.tone] ?? "📝"}</span>
              <div className="min-w-0">
                <p className="text-sm text-[var(--text)] truncate">
                  {item.originalText.slice(0, 120)}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  <span className="capitalize">{item.tone}</span>
                  {" · "}
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform duration-300 ${
                expandedId === item._id ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedId === item._id && (
            <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)] animate-expand">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                <div className="animate-slide-left" style={{ animationDelay: "0.05s" }}>
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Original</p>
                  <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text-secondary)] whitespace-pre-wrap max-h-40 overflow-auto">
                    {item.originalText}
                  </div>
                </div>
                <div className="animate-slide-right" style={{ animationDelay: "0.1s" }}>
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Humanized</p>
                  <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] whitespace-pre-wrap max-h-40 overflow-auto">
                    {item.humanizedText}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(item.humanizedText, item._id)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-all duration-200 active:scale-95 ${
                    copiedId === item._id
                      ? "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30 animate-badge-pop"
                      : "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text)] border-[var(--border)]"
                  }`}
                >
                  {copiedId === item._id ? "✓ Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => handleRemove(item._id)}
                  className="px-3 py-1.5 text-xs rounded-md text-[var(--danger)] hover:bg-red-500/10 transition-all duration-200 active:scale-95"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
