type LoadingKind = "page" | "action";
type LoadingSnapshot = Readonly<Record<LoadingKind, number>>;

const emptySnapshot: LoadingSnapshot = { page: 0, action: 0 };
let snapshot = emptySnapshot;
const listeners = new Set<() => void>();

export const getLoadingSnapshot = () => snapshot;
export const getServerLoadingSnapshot = () => emptySnapshot;
export function subscribeToLoading(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Each operation releases its own token; one completed request cannot hide another. */
export function beginLoadingActivity(kind: LoadingKind = "action") {
  snapshot = { ...snapshot, [kind]: snapshot[kind] + 1 };
  listeners.forEach((listener) => listener());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    snapshot = { ...snapshot, [kind]: Math.max(0, snapshot[kind] - 1) };
    listeners.forEach((listener) => listener());
  };
}
