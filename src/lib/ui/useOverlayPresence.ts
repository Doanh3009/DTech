"use client";

import { useCallback, useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
// Matches --ui-motion-exit in mobile-motion.css; the extra frame is a fallback
// when the browser suppresses animationend while changing tabs.
const OVERLAY_EXIT_DURATION_MS = 160;

/** Retains the dialog and its focus/scroll lock until the exit has finished. */
export function useOverlayPresence(open: boolean, portalReady: boolean) {
  const [presence, setPresence] = useState({ requestedOpen: open, present: open });
  const animateExit = portalReady
    && typeof window.matchMedia === "function"
    && !window.matchMedia(REDUCED_MOTION_QUERY).matches;

  if (presence.requestedOpen !== open) {
    setPresence({ requestedOpen: open, present: open || (presence.present && animateExit) });
  }

  const present = open || presence.present;
  const finishExit = useCallback(() => {
    setPresence((current) => current.requestedOpen ? current : { ...current, present: false });
  }, []);

  useEffect(() => {
    if (open || !present || !portalReady) return;
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const timeout = window.setTimeout(finishExit, OVERLAY_EXIT_DURATION_MS + 32);
    const stopMotion = () => { if (reducedMotion.matches) finishExit(); };
    reducedMotion.addEventListener?.("change", stopMotion);
    return () => {
      window.clearTimeout(timeout);
      reducedMotion.removeEventListener?.("change", stopMotion);
    };
  }, [finishExit, open, portalReady, present]);

  return { present, state: open ? "open" : present ? "closing" : "closed", finishExit };
}
