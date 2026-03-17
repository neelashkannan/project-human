"use client";

import { useState, useEffect, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "./AuthProvider";

const TONES = [
  { id: "casual", label: "Casual", desc: "Friendly & relaxed", emoji: "💬" },
  { id: "professional", label: "Professional", desc: "Clear & polished", emoji: "💼" },
  { id: "academic", label: "Academic", desc: "Scholarly & precise", emoji: "🎓" },
  { id: "creative", label: "Creative", desc: "Vivid & expressive", emoji: "🎨" },
];

const MODELS = [
  { id: "monkey", label: "Monkey-v1", desc: "Super fast", emoji: "⚡" },
  { id: "monk", label: "Justin Monk v2", desc: "Super good", emoji: "🧘" },
  { id: "hypermonk", label: "Arromal-hypermonk", desc: "Super powered monk", emoji: "🔥" },
];

type SaveFn = ((args: {
  originalText: string;
  humanizedText: string;
  tone: string;
  model?: string;
  userId?: string;
}) => Promise<unknown>) | null;

type HumanizeFn = ((args: {
  text: string;
  tone: string;
  model?: string;
}) => Promise<string>) | null;

/** Wrapper that injects Convex hooks (only mounts when ConvexProvider exists) */
function ConnectedForm() {
  const saveConversion = useMutation(api.conversions.save);
  const humanizeAction = useAction(api.humanize.humanize);
  return <FormUI saveConversion={saveConversion} humanizeAction={humanizeAction} />;
}

/** Main export — chooses connected vs offline form */
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
  const [tone, setTone] = useState("casual");
  const [model, setModel] = useState("monkey");
  const [modelOpen, setModelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const { user, signInWithGoogle } = useAuth();

  // Typewriter effect for output
  useEffect(() => {
    if (!outputText) {
      setDisplayedText("");
      return;
    }

    let i = 0;
    setDisplayedText("");
    const speed = Math.max(5, Math.min(20, 2000 / outputText.length));

    const interval = setInterval(() => {
      if (i < outputText.length) {
        setDisplayedText(outputText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [outputText]);

  const handleHumanize = async () => {
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
      const humanizedText = await humanizeAction({
        text: inputText.trim(),
        tone,
        model,
      });

      setOutputText(humanizedText);

      if (saveConversion) {
        try {
          await saveConversion({
            originalText: inputText.trim(),
            humanizedText,
            tone,
            model,
            userId: user?.uid,
          });
        } catch {
          // Don't block UI if Convex save fails
        }
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      // Extract the user-friendly message from Convex error wrapping
      let msg: string;
      if (raw.includes("busy due to high demand")) {
        msg = "This model is currently busy due to high demand. Please try again in a moment or switch to a different model.";
      } else if (raw.includes("Something went wrong")) {
        msg = "Something went wrong while humanizing your text. Please try again or switch to a different model.";
      } else {
        msg = "Failed to humanize text. Please try again or switch to a different model.";
      }
      setError(msg);
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = inputText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Tone Selector */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
          Tone
        </label>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={`group px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                tone === t.id
                  ? "tone-active border border-[var(--accent)] text-[var(--accent-hover)]"
                  : "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-hover)] hover:scale-[1.03] active:scale-[0.97]"
              }`}
            >
              <span className={`transition-transform duration-200 ${tone === t.id ? "scale-110" : "group-hover:scale-110"}`}>
                {t.emoji}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input / Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input */}
        <div className="space-y-2 animate-slide-left" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              AI Text
            </label>
            <span className={`text-xs transition-colors duration-300 ${
              wordCount > 9000 ? "text-[var(--danger)]" : wordCount > 7000 ? "text-yellow-500" : "text-[var(--text-muted)]"
            }`}>
              {wordCount.toLocaleString()} / 10,000 words
            </span>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => {
              const words = e.target.value.trim().split(/\s+/).filter(Boolean).length;
              if (words <= 10000) setInputText(e.target.value);
            }}
            placeholder="Paste your AI-generated text here (up to 10,000 words)..."
            className="w-full h-56 p-4 input-well text-[var(--text)] text-sm placeholder-[var(--text-muted)] resize-none focus:outline-none"
          />
          {/* Word count progress bar */}
          <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(100, (wordCount / 10000) * 100)}%`,
                background: wordCount > 9000 ? "var(--danger)" : wordCount > 7000 ? "#eab308" : "var(--accent)",
              }}
            />
          </div>
        </div>

        {/* Output */}
        <div className="space-y-2 animate-slide-right" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Result
              </label>
              {/* Model Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setModelOpen(!modelOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-all duration-200"
                >
                  <span>{MODELS.find((m) => m.id === model)?.emoji}</span>
                  <span>{MODELS.find((m) => m.id === model)?.label}</span>
                  <svg className={`w-3 h-3 transition-transform duration-200 ${modelOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {modelOpen && (
                  <div className="absolute top-full left-0 mt-1 z-20 min-w-[160px] rounded-xl bg-[var(--surface-2)] border border-[var(--border)] shadow-xl shadow-black/30 overflow-hidden animate-scale-in">
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setModel(m.id); setModelOpen(false); }}
                        className={`w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-xs transition-all duration-150 ${
                          model === m.id
                            ? "bg-[var(--accent-muted)] text-[var(--accent-hover)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                        }`}
                      >
                        <span className="text-sm">{m.emoji}</span>
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold">{m.label}</span>
                          <span className="text-[10px] opacity-60">{m.desc}</span>
                        </span>
                        {model === m.id && (
                          <svg className="w-3.5 h-3.5 ml-auto text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {outputText && (
              <button
                onClick={handleCopy}
                className={`text-xs px-2.5 py-1 rounded-md border transition-all duration-200 ${
                  copied
                    ? "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30 animate-badge-pop"
                    : "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text)] border-[var(--border)] hover:scale-105 active:scale-95"
                }`}
              >
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            )}
          </div>
          <div ref={outputRef} className="w-full h-56 p-4 input-well overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="relative">
                  <div className="spinner w-8 h-8" />
                  <div className="absolute inset-0 spinner w-8 h-8 opacity-30" style={{ animationDelay: "-0.4s" }} />
                </div>
                <div className="text-center">
                  <span className="text-sm text-[var(--text-muted)] block">Humanizing your text</span>
                  <span className="text-xs text-[var(--text-muted)] opacity-60 mt-1 block">
                    <span className="animate-blink">|</span>
                  </span>
                </div>
                <div className="w-48 progress-bar" />
              </div>
            ) : displayedText ? (
              <p className="text-[var(--text)] text-sm whitespace-pre-wrap leading-relaxed">
                {displayedText}
                {displayedText.length < outputText.length && (
                  <span className="animate-blink text-[var(--accent)]">|</span>
                )}
              </p>
            ) : (
              <p className="text-[var(--text-muted)] text-sm animate-float">
                Humanized text will appear here...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={`p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm ${shakeError ? "animate-shake" : ""}`}>
          {error}
        </div>
      )}

      {/* Submit */}
      {user ? (
        <button
          onClick={handleHumanize}
          disabled={loading || !inputText.trim()}
          className="w-full py-3 btn-primary btn-ripple text-base disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          <span className="flex items-center justify-center gap-2">
            {loading ? (
              <>
                <div className="spinner w-4 h-4" />
                Humanizing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 transition-transform duration-200 group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                Humanize
              </>
            )}
          </span>
        </button>
      ) : (
        <button
          onClick={() => void signInWithGoogle()}
          className="w-full py-3 btn-primary btn-ripple text-base flex items-center justify-center gap-2 group"
        >
          <svg className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google to Humanize
        </button>
      )}
    </div>
  );
}
