"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

const AuthEnabledContext = createContext(false);

export function useAuthEnabled() {
  return useContext(AuthEnabledContext);
}

/** Wraps the tree in ClerkProvider only when keys exist (ADR-0002). */
export function AuthProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const inner = <AuthEnabledContext.Provider value={enabled}>{children}</AuthEnabledContext.Provider>;
  if (!enabled) return inner;
  return <ClerkProvider>{inner}</ClerkProvider>;
}
