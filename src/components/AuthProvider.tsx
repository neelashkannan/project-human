"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { auth, googleProvider } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const upsertUser = useMutation(api.users.upsert);

  const syncUser = useCallback(async (firebaseUser: User) => {
    await upsertUser({
      firebaseUid: firebaseUser.uid,
      name: firebaseUser.displayName ?? "Anonymous",
      email: firebaseUser.email ?? "",
      photoURL: firebaseUser.photoURL ?? undefined,
    });
  }, [upsertUser]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        syncUser(u);
      }
    });
  }, [syncUser]);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
