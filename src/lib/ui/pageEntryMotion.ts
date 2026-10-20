/** React's transition classes require the newer, per-participant browser API. */
export function supportsPageViewTransitions(documentToCheck: Document = document) {
  return typeof documentToCheck.startViewTransition === "function"
    && "viewTransitionClass" in documentToCheck.documentElement.style;
}

/** Fallback for older browsers; keeps the existing page and form DOM intact. */
export function animatePageEntry(element: HTMLElement, reducedMotion = false) {
  if (reducedMotion || typeof element.animate !== "function") return undefined;
  try {
    return element.animate([
      { opacity: 0.78, transform: "translateY(6px)" },
      { opacity: 1, transform: "translateY(0)" }
    ], { duration: 240, easing: "cubic-bezier(.22,.72,.2,1)" });
  } catch {
    // Some embedded browsers expose the API but reject animations. Navigation
    // and the existing form remain usable when motion is unavailable.
    return undefined;
  }
}
