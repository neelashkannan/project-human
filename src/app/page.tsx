"use client";

import HumanizeForm from "@/components/HumanizeForm";
import HistoryList from "@/components/HistoryList";

export default function Home() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div>
      <div className="bg-gradient" />

      {/* ── Hero ── */}
      <section
        id="hero"
        className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center py-20"
      >
        <div className="anim-stagger-1 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--accent-muted)] border border-[var(--accent)]/20 text-sm text-[var(--accent-hover)] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          Powered by Neelash Intelligence
        </div>

        <h1 className="anim-stagger-2 text-4xl sm:text-6xl font-bold tracking-tight mb-5 leading-[1.1]">
          <span className="text-[var(--text)]">Make AI Text</span>
          <br />
          <span className="text-gradient">Sound Human</span>
        </h1>

        <p className="anim-stagger-3 text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-10 leading-relaxed">
          Instantly transform AI-generated text into natural, authentic writing.
          Pick a tone and go.
        </p>

        <button
          onClick={() => scrollTo("humanize")}
          className="anim-stagger-4 btn-primary btn-ripple px-8 py-3.5 text-base animate-pulse-glow"
        >
          Start Humanizing
        </button>
      </section>

      {/* ── Humanize ── */}
      <section id="humanize" className="px-4 pb-20 scroll-mt-20">
        <div className="max-w-4xl mx-auto animate-fade-up">
          <div className="card p-6 sm:p-8">
            <HumanizeForm />
          </div>
        </div>
      </section>

      {/* ── History ── */}
      <section id="history" className="px-4 pb-28 scroll-mt-20">
        <div className="max-w-4xl mx-auto animate-fade-up">
          <h2 className="text-xl font-semibold text-[var(--text)] mb-4">
            Recent Conversions
          </h2>
          <HistoryList />
        </div>
      </section>
    </div>
  );
}
