"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";
import AuthProvider from "./AuthProvider";

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl || !convexUrl.startsWith("http")) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!client) {
    return <AuthProvider convexAvailable={false}>{children}</AuthProvider>;
  }

  return (
    <ConvexProvider client={client}>
      <AuthProvider convexAvailable={true}>
        {children}
      </AuthProvider>
    </ConvexProvider>
  );
}
