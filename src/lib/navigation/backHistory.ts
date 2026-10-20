const STATE_KEY = "ctBackHistoryV1";
const MAX_ENTRIES = 64;

interface Entry {
  href: string;
  index: number;
}

interface BackHistory extends Entry {
  accountId: string;
  previous: Entry[];
}

let activeAccount: string | undefined;
let pendingBack = false;
let pendingTimer: ReturnType<typeof setTimeout> | undefined;

function currentHref() {
  return window.location.pathname + window.location.search + window.location.hash;
}

function readHistory(): BackHistory | undefined {
  const value = window.history.state?.[STATE_KEY] as BackHistory | undefined;
  if (!value || value.accountId !== activeAccount || value.href !== currentHref()
    || !Number.isInteger(value.index) || !Array.isArray(value.previous)) return;
  return value;
}

function pathname(href: string) {
  return href.split(/[?#]/, 1)[0];
}

function resetPending() {
  pendingBack = false;
  clearTimeout(pendingTimer);
}

/** Track actual history entries, including replace and browser back/forward.
 * Each entry carries its own return chain so refresh does not lose context.
 * Next's own history state is retained verbatim alongside our namespaced field.
 */
export function installBackHistory(accountId: string) {
  activeAccount = accountId;
  let active = true;
  const history = window.history;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;

  const initial = readHistory() ?? { accountId, href: currentHref(), index: 0, previous: [] };
  originalReplace.call(history, { ...history.state, [STATE_KEY]: initial }, "");

  function nextState(url: string | URL | null | undefined, push: boolean): BackHistory {
    const current = readHistory() ?? { accountId, href: currentHref(), index: 0, previous: [] };
    const target = new URL(url ?? window.location.href, window.location.href);
    const href = target.pathname + target.search + target.hash;
    let previous = [...current.previous];
    if (push && href !== current.href) previous.push({ href: current.href, index: current.index });

    if (pathname(href) !== pathname(current.href)) {
      // Re-entering a screen through a menu/save link closes its child flow.
      // Otherwise list -> detail -> list would make Back reopen the detail.
      let ancestor = -1;
      for (let i = previous.length - 1; i >= 0; i -= 1) {
        if (pathname(previous[i].href) === pathname(href)) { ancestor = i; break; }
      }
      if (ancestor >= 0) previous = previous.slice(0, ancestor);
      while (previous.length && pathname(previous[previous.length - 1].href).startsWith(`${pathname(href)}/`)) {
        previous.pop();
      }
    }

    return { accountId, href, index: current.index + (push ? 1 : 0), previous: previous.slice(-MAX_ENTRIES) };
  }

  const push: History["pushState"] = function (data, unused, url) {
    const state = active ? { ...data, [STATE_KEY]: nextState(url, true) } : data;
    originalPush.call(history, state, unused, url);
  };
  const replace: History["replaceState"] = function (data, unused, url) {
    const state = active ? { ...data, [STATE_KEY]: nextState(url, false) } : data;
    originalReplace.call(history, state, unused, url);
  };
  history.pushState = push;
  history.replaceState = replace;
  window.addEventListener("popstate", resetPending);

  return () => {
    active = false;
    if (history.pushState === push) history.pushState = originalPush;
    if (history.replaceState === replace) history.replaceState = originalReplace;
    window.removeEventListener("popstate", resetPending);
    activeAccount = undefined;
    resetPending();
  };
}

/** False means there is no known earlier app entry; use the safe fallback. */
export function goBackInApp(): boolean {
  if (pendingBack) return true;
  const current = readHistory();
  const previous = current?.previous.at(-1);
  if (!current || !previous || previous.index >= current.index) return false;

  pendingBack = true;
  pendingTimer = setTimeout(resetPending, 1500);
  window.history.go(previous.index - current.index);
  return true;
}
