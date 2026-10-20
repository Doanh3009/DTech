"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import type { MobileNavDestination } from "@/config/mobileNavigationResolver";

interface MobileNavigationOverride {
  token: symbol;
  items: readonly MobileNavDestination[];
}

interface MobileNavigationContextValue {
  override?: MobileNavigationOverride;
  register: (items: readonly MobileNavDestination[]) => () => void;
}

const MobileNavigationContext = createContext<MobileNavigationContextValue | null>(null);

export function MobileNavigationProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<MobileNavigationOverride>();
  const register = useCallback((items: readonly MobileNavDestination[]) => {
    const token = Symbol("mobile-navigation");
    setOverride({ token, items });
    return () => setOverride((current) => current?.token === token ? undefined : current);
  }, []);
  return <MobileNavigationContext.Provider value={{ override, register }}>{children}</MobileNavigationContext.Provider>;
}

export function useMobileNavigation() {
  const context = useContext(MobileNavigationContext);
  if (!context) throw new Error("MobileNavigationProvider is missing");
  return context;
}

export function useOptionalMobileNavigation() {
  return useContext(MobileNavigationContext);
}
