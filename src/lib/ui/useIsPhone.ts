"use client";

import { useSyncExternalStore } from "react";

const PHONE_QUERY = "(max-width: 767px)";

function subscribe(callback: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function snapshot() {
  return typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches;
}

export function useIsPhone() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
