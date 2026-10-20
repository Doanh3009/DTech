"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AuthenticatedUser } from "@/lib/auth/permissions";

const CurrentUserContext = createContext<AuthenticatedUser | null>(null);

export function CurrentUserProvider({ children, user }: { children: ReactNode; user: AuthenticatedUser }) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): AuthenticatedUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return user;
}
