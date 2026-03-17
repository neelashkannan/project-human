"use client";

import { useEffect } from "react";

export default function HumanizePage() {
  useEffect(() => {
    const base = window.location.pathname.replace(/\/humanize\/?$/, "/");
    window.location.replace(base + "#humanize");
  }, []);
  return null;
}
