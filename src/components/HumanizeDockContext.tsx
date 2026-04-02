"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SubmitHandler = (() => Promise<void> | void) | null;

interface HumanizeDockContextValue {
  model: string;
  setModel: (value: string) => void;
  tone: string;
  setTone: (value: string) => void;
  perspective: string;
  setPerspective: (value: string) => void;
  wordCount: number;
  setWordCount: (value: number) => void;
  canSubmit: boolean;
  setCanSubmit: (value: boolean) => void;
  loading: boolean;
  setLoading: (value: boolean) => void;
  registerSubmit: (handler: SubmitHandler) => () => void;
  runSubmit: () => Promise<void>;
}

const HumanizeDockContext = createContext<HumanizeDockContextValue | null>(null);

export const HUMANIZE_MODELS = [
  { id: "monkey", label: "Monkey-v1", desc: "Super fast" },
  { id: "monk", label: "Justin Monk v2", desc: "Super good" },
  { id: "hypermonk", label: "Arromal-hypermonk", desc: "Super powered" },
];

export const HUMANIZE_TONES = [
  { id: "casual", label: "Casual" },
  { id: "academic", label: "Academic" },
  { id: "professional", label: "Professional" },
  { id: "creative", label: "Creative" },
];

export const HUMANIZE_PERSPECTIVES = [
  { id: "first_person", label: "First Person" },
  { id: "third_person", label: "Third Person" },
];

export function HumanizeDockProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState("monkey");
  const [tone, setTone] = useState("casual");
  const [perspective, setPerspective] = useState("first_person");
  const [wordCount, setWordCount] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const [loading, setLoading] = useState(false);
  const submitRef = useRef<SubmitHandler>(null);

  const registerSubmit = useCallback((handler: SubmitHandler) => {
    submitRef.current = handler;
    return () => {
      if (submitRef.current === handler) {
        submitRef.current = null;
      }
    };
  }, []);

  const runSubmit = useCallback(async () => {
    if (!submitRef.current) return;
    await submitRef.current();
  }, []);

  const value = useMemo(
    () => ({
      model,
      setModel,
      tone,
      setTone,
      perspective,
      setPerspective,
      wordCount,
      setWordCount,
      canSubmit,
      setCanSubmit,
      loading,
      setLoading,
      registerSubmit,
      runSubmit,
    }),
    [canSubmit, loading, model, perspective, registerSubmit, runSubmit, tone, wordCount]
  );

  return <HumanizeDockContext.Provider value={value}>{children}</HumanizeDockContext.Provider>;
}

export function useHumanizeDock() {
  const context = useContext(HumanizeDockContext);
  if (!context) {
    throw new Error("useHumanizeDock must be used within HumanizeDockProvider");
  }
  return context;
}