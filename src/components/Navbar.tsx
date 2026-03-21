"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import {
  HUMANIZE_MODELS,
  HUMANIZE_TONES,
  useHumanizeDock,
} from "./HumanizeDockContext";
import { useTheme } from "./ThemeProvider";
import Logo from "./Logo";

const IconBolt = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

const IconBrain = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5m-4.75-11.396c.251.023.501.05.75.082M12 3v5.714" />
  </svg>
);

const IconFire = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.468 5.99 5.99 0 00-1.925 3.547 5.975 5.975 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
  </svg>
);

const IconGauge = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

const IconSparkle = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

const IconMoon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7.5 7.5 0 009.79 9.79z" />
  </svg>
);

const IconSun = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25M12 18.75V21M4.72 4.72l1.59 1.59M17.69 17.69l1.59 1.59M3 12h2.25M18.75 12H21M4.72 19.28l1.59-1.59M17.69 6.31l1.59-1.59" />
    <circle cx="12" cy="12" r="3.75" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const MODEL_ICONS: Record<string, React.ReactNode> = {
  monkey: <IconBolt className="h-4 w-4" />,
  monk: <IconBrain className="h-4 w-4" />,
  hypermonk: <IconFire className="h-4 w-4" />,
};

const TONE_ICONS: Record<string, React.ReactNode> = {
  low: <IconGauge className="h-4 w-4" />,
  medium: <IconGauge className="h-4 w-4" />,
  high: <IconGauge className="h-4 w-4" />,
  extra_high: <IconGauge className="h-4 w-4" />,
};

const MODEL_DOCK_LABELS: Record<string, string> = {
  monkey: "Monkey",
  monk: "Monk",
  hypermonk: "Hypermonk",
};

const TONE_DOCK_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  extra_high: "Extra High",
};

const DOCK_ITEMS = [
  {
    id: "hero",
    label: "Home",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    id: "humanize",
    label: "Humanize",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "History",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function Navbar() {
  const [activeSection, setActiveSection] = useState("hero");
  const [modelOpen, setModelOpen] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    model,
    setModel,
    tone,
    setTone,
    runSubmit,
    loading: humanizing,
    canSubmit,
    wordCount,
  } = useHumanizeDock();
  const showHumanizeControls = pathname === "/";
  const homeDockItems = DOCK_ITEMS.filter((item) => item.id === "history");
  const visibleDockItems = showHumanizeControls ? homeDockItems : DOCK_ITEMS;
  const showAccountButton = !showHumanizeControls || Boolean(user) || loading;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3 }
    );

    DOCK_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setModelOpen(false);
        setToneOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    setModelOpen(false);
    setToneOpen(false);
  }, [pathname]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDockPrimary = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    await runSubmit();
  };

  return (
    <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 animate-dock-entrance">
      <div className="dock w-fit max-w-[calc(100vw-1rem)] px-3 py-2.5">
        <div className="dock-shell">
          <div className="dock-section dock-section-nav">
            <button
              onClick={() => scrollTo("hero")}
              className="dock-brand"
              aria-label="justin.human"
            >
              <Logo size={24} />
            </button>

            <div className="dock-divider" />

            {visibleDockItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`dock-item ${activeSection === item.id ? "active" : ""}`}
              >
                <span className="dock-tooltip">{item.label}</span>
                {item.icon}
              </button>
            ))}
          </div>

          {showHumanizeControls && (
            <div className="dock-section dock-section-controls" ref={controlsRef}>
              <div className="dock-controls-group">
                <div className="relative">
                  <button
                    onClick={() => {
                      setModelOpen((current) => !current);
                      setToneOpen(false);
                    }}
                    className="dock-control"
                  >
                    <span className="dock-control-label">Model</span>
                    <span className="dock-control-value">
                      {MODEL_ICONS[model]}
                      <span>{MODEL_DOCK_LABELS[model]}</span>
                    </span>
                    <IconChevron open={modelOpen} />
                  </button>
                  {modelOpen && (
                    <div className="dock-dropdown min-w-[220px]">
                      {HUMANIZE_MODELS.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setModel(item.id);
                            setModelOpen(false);
                          }}
                          className={`neu-dropdown-item ${model === item.id ? "neu-dropdown-active" : ""}`}
                        >
                          {MODEL_ICONS[item.id]}
                          <span className="flex flex-col leading-tight">
                            <span className="font-semibold text-sm">{item.label}</span>
                            <span className="text-[10px] text-[var(--neu-text-muted)]">{item.desc}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={() => {
                      setToneOpen((current) => !current);
                      setModelOpen(false);
                    }}
                    className="dock-control"
                  >
                    <span className="dock-control-label">Tone</span>
                    <span className="dock-control-value">
                      {TONE_ICONS[tone]}
                      <span>{TONE_DOCK_LABELS[tone]}</span>
                    </span>
                    <IconChevron open={toneOpen} />
                  </button>
                  {toneOpen && (
                    <div className="dock-dropdown min-w-[180px]">
                      {HUMANIZE_TONES.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setTone(item.id);
                            setToneOpen(false);
                          }}
                          className={`neu-dropdown-item ${tone === item.id ? "neu-dropdown-active" : ""}`}
                        >
                          {TONE_ICONS[item.id]}
                          <span className="font-semibold text-sm">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="dock-status" aria-live="polite">
                  <span className="dock-status-label">Input</span>
                  <span className="dock-status-value">{wordCount} / 500</span>
                </div>
              </div>

              <button
                onClick={() => void handleDockPrimary()}
                disabled={Boolean(humanizing || (!user && loading) || (!!user && !canSubmit))}
                className="dock-run-btn"
              >
                {humanizing ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <IconSparkle className="h-4 w-4" />
                )}
                <span>{user ? "Humanize" : "Sign in"}</span>
              </button>
            </div>
          )}

          <div className="dock-section dock-section-account">
            <button
              onClick={toggleTheme}
              className="dock-item"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className="dock-tooltip">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              {theme === "dark" ? <IconSun className="w-5 h-5" /> : <IconMoon className="w-5 h-5" />}
            </button>

            {showAccountButton && (
              <>
                <div className="dock-divider hidden md:block" />

                {loading ? (
                  <div className="dock-item">
                    <div className="w-3 h-3 border-2 border-[var(--neu-text-muted)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : user ? (
                  <button
                    onClick={() => void signOut()}
                    className="dock-item"
                  >
                    <span className="dock-tooltip">{user.displayName ?? "Sign Out"}</span>
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName ?? "User"}
                        className="w-6 h-6 rounded-full border border-[var(--neu-border)]"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => void signInWithGoogle()}
                    className="dock-item"
                  >
                    <span className="dock-tooltip">Sign in with Google</span>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
