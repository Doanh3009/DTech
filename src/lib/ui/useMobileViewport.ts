"use client";

import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function snapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function useMobileViewport(): boolean | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
