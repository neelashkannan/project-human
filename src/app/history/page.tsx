"use client";

import { useEffect } from "react";

export default function HistoryPage() {
  useEffect(() => {
    const base = window.location.pathname.replace(/\/history\/?$/, "/");
    window.location.replace(base + "#history");
  }, []);
  return null;
}
