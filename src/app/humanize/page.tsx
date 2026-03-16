"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HumanizePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/#humanize");
  }, [router]);
  return null;
}
