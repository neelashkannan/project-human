"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "./AuthProvider";
import { useHumanizeDock } from "./HumanizeDockContext";

const IconCheck = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconCopy = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
);

const WORD_LIMIT = 500;

function clampToWordLimit(text: string, limit: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) {
    return text;
  }

  return words.slice(0, limit).join(" ");
}

type SaveFn = ((args: {
  originalText: string;
  humanizedText: string;
  tone: string;
  perspective?: string;
  model?: string;
  userId?: string;
}) => Promise<unknown>) | null;

type HumanizeFn = ((args: {
  text: string;
  tone: string;
  perspective?: string;
  model?: string;
}) => Promise<string>) | null;

function ConnectedForm() {
  const saveConversion = useMutation(api.conversions.save);
  const humanizeAction = useAction(api.humanize.humanize);
  return <FormUI saveConversion={saveConversion} humanizeAction={humanizeAction} />;
}

export default function HumanizeForm() {
  const { convexAvailable } = useAuth();
  if (convexAvailable) return <ConnectedForm />;
  return <FormUI saveConversion={null} humanizeAction={null} />;
}

function FormUI({
  saveConversion,
  humanizeAction,
}: {
  saveConversion: SaveFn;
  humanizeAction: HumanizeFn;
}) {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const {
    model,
    tone,
    perspective,
    wordCount,
    setWordCount,
    setCanSubmit,
    loading,
    setLoading,
    registerSubmit,
  } = useHumanizeDock();

  const handleHumanize = useCallback(async () => {
    if (!inputText.trim()) return;
    if (!humanizeAction) {
      setError("Backend is not connected. Please try again later.");
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
      return;
    }
    setLoading(true);
    setError("");
    setOutputText("");

    try {
      const humanizedText = await humanizeAction({ text: inputText.trim(), tone, perspective, model });
      setOutputText(humanizedText);
      if (saveConversion) {
        try { await saveConversion({ originalText: inputText.trim(), humanizedText, tone, perspective, model, userId: user?.uid }); } catch { /* silent */ }
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      let msg: string;
      if (raw.includes("busy due to high demand")) msg = "This model is currently busy. Please try again or switch models.";
      else if (raw.includes("Something went wrong")) msg = "Something went wrong. Please try again or switch models.";
      else msg = "Failed to humanize text. Please try again or switch models.";
      setError(msg);
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
    } finally { setLoading(false); }
  }, [humanizeAction, inputText, model, perspective, saveConversion, setLoading, tone, user?.uid]);

  useEffect(() => {
    if (!outputText) { setDisplayedText(""); return; }
    let i = 0;
    setDisplayedText("");
    const speed = Math.max(5, Math.min(20, 2000 / outputText.length));
    const interval = setInterval(() => {
      if (i < outputText.length) { setDisplayedText(outputText.slice(0, i + 1)); i++; }
      else clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [outputText]);

  useEffect(() => {
    const nextWordCount = inputText.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(nextWordCount);
    setCanSubmit(Boolean(inputText.trim()));
  }, [inputText, setCanSubmit, setWordCount]);

  useEffect(() => registerSubmit(handleHumanize), [registerSubmit, handleHumanize]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="neu-banner flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--neu-text)]">
            Humanization workspace
          </p>
          <p className="mt-1 text-sm text-[var(--neu-text-secondary)]">
            Controls now live in the dock for faster access.
          </p>
        </div>

        <div className="min-w-0 sm:max-w-xs sm:text-right">
          <p className="text-sm font-medium text-[var(--neu-text)]">
            {wordCount.toLocaleString()} / 500 words
          </p>
          <p className="mt-1 text-sm text-[var(--neu-text-secondary)]">
            {user ? "History will be saved automatically." : "Sign in to save your conversions."}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="soft-panel p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--neu-text-secondary)]">
                  Input
                </label>
                <p className="mt-1 text-sm text-[var(--neu-text-muted)]">Drop in raw AI-generated copy.</p>
              </div>
            </div>

            <div className="neu-well">
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(clampToWordLimit(e.target.value, WORD_LIMIT));
                }}
                placeholder="Paste up to 500 words of AI-generated text here..."
                className="h-72 w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--neu-text)] placeholder:text-[var(--neu-text-muted)] focus:outline-none"
              />
            </div>
            <div className="neu-progress-track mt-4 h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(100, (wordCount / WORD_LIMIT) * 100)}%`,
                  background: wordCount > 450 ? "#ef4444" : wordCount > 350 ? "#f59e0b" : "var(--neu-accent)",
                }}
              />
            </div>
          </div>

        <div className="soft-panel p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--neu-text-secondary)]">
                  Output
                </label>
                <p className="mt-1 text-sm text-[var(--neu-text-muted)]">Refined text appears here as it completes.</p>
              </div>
              {outputText && (
                <button onClick={handleCopy} className="neu-btn-sm">
                  {copied ? <><IconCheck className="h-3.5 w-3.5" /> Copied</> : <><IconCopy /> Copy</>}
                </button>
              )}
            </div>

            <div ref={outputRef} className="neu-well overflow-auto" style={{ minHeight: "20rem" }}>
              {loading ? (
                <div className="flex h-72 flex-col items-center justify-center gap-4">
                  <div className="neu-spinner" />
                  <span className="text-sm font-medium text-[var(--neu-text-secondary)]">Humanizing...</span>
                </div>
              ) : displayedText ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--neu-text)]">
                  {displayedText}
                  {displayedText.length < outputText.length && (
                    <span className="animate-blink text-[var(--neu-accent)]">|</span>
                  )}
                </p>
              ) : (
                <div className="flex h-72 flex-col justify-center gap-3 text-[var(--neu-text-muted)]">
                  <p className="text-sm italic">Humanized text will appear here...</p>
                  <p className="max-w-sm text-sm leading-6">
                    Your rewritten output will stream here so you can compare the result against the source without leaving the canvas.
                  </p>
                </div>
              )}
            </div>
        </div>

      </div>

      {error && (
        <div className={`neu-error ${shakeError ? "animate-shake" : ""}`}>
          {error}
        </div>
      )}

      <div className="text-sm text-[var(--neu-text-secondary)]">
        Use the dock to switch model, adjust intensity, and run humanization.
      </div>
    </div>
  );
}
