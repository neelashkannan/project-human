"use client";

import HumanizeForm from "@/components/HumanizeForm";
import HistoryList from "@/components/HistoryList";

export default function Home() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="pb-6">
      <section id="hero" className="px-4 pb-12 pt-10 sm:pt-14">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="neu-pill anim-stagger-1 inline-flex items-center gap-2 px-4 py-1.5 text-sm text-[var(--neu-text-secondary)]">
              <span className="h-2 w-2 rounded-full bg-[var(--neu-accent)]" />
              Built by neelash intelligence
            </div>

            <h1 className="anim-stagger-2 mt-6 text-5xl font-semibold tracking-[-0.05em] text-[var(--neu-text)] sm:text-6xl md:text-7xl">
              Make AI writing
              <span className="block text-gradient">feel naturally human.</span>
            </h1>

            <p className="anim-stagger-3 mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--neu-text-secondary)] sm:text-xl">
              A clean rewriting workspace for turning raw AI output into smoother, more convincing copy without the noise of an overdesigned interface.
            </p>

            <div className="anim-stagger-4 mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => scrollTo("humanize")}
                className="neu-btn-primary px-8 py-3.5 text-base"
              >
                Start Humanizing
              </button>
              <button
                onClick={() => scrollTo("history")}
                className="neu-btn-sm px-5 py-3 text-sm"
              >
                Recent History
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="humanize" className="scroll-mt-20 px-4 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Workspace</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--neu-text)] sm:text-4xl">
                A focused rewrite canvas.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[var(--neu-text-secondary)] sm:text-right">
              Choose the model, set intensity, paste your source, and review the result in one clean side-by-side view.
            </p>
          </div>

          <div className="card animate-fade-up p-4 sm:p-6 lg:p-8">
            <HumanizeForm />
          </div>
        </div>
      </section>

      <section id="history" className="scroll-mt-20 px-4 pb-28">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-4">
            <p className="section-kicker">Archive</p>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--neu-text)]">
              Recent conversions.
            </h2>
            <p className="text-base leading-7 text-[var(--neu-text-secondary)]">
              Expand, compare, copy, or remove previous rewrites without leaving the main workspace.
            </p>
          </div>

          <div className="card animate-fade-up p-4 sm:p-6">
            <HistoryList />
          </div>
        </div>
      </section>
    </div>
  );
}
