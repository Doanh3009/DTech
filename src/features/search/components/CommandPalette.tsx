"use client";

import { ArrowRight, Command, CornerDownLeft, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/shared/Button";
import { useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { enabledModulePermissions } from "@/config/erpModules";
import { applicationForPath } from "@/config/moduleRegistry";
import { isPathEnabled } from "@/config/systemSettings";
import { commandsForUser, type AppCommand } from "@/features/search/commandRegistry";
import { internalSearchPath, searchTypesForApplication } from "@/features/search/moduleSearchScope";
import { recordRecentResult, SearchResultList } from "@/features/search/components/SearchResultList";
import type { GlobalSearchResponse, RecentEntity, SearchResult } from "@/features/search/types";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { acquireBodyScrollLock } from "@/lib/ui/bodyScrollLock";

interface SearchBody { ok: boolean; data?: GlobalSearchResponse; }
interface RecentBody { ok: boolean; data?: { items: RecentEntity[] }; }
type Selectable = { kind: "command"; item: AppCommand } | { kind: "result"; item: SearchResult };

export function CommandPalette({ user }: { user: AuthenticatedUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useSystemSettings();
  const application = applicationForPath(pathname);
  const applicationId = pathname === "/applications" ? undefined : application.id;
  const searchLabel = applicationId ? `Tìm trong ${application.label}` : "Tìm kiếm toàn hệ thống";
  const searchTypes = useMemo(() => applicationId ? searchTypesForApplication(applicationId) : undefined, [applicationId]);
  const effectiveUser = useMemo(() => ({ ...user, permissions: enabledModulePermissions(user.permissions, settings.modules) }), [settings.modules, user]);
  const matchesScope = useCallback((href: string) => {
    const path = internalSearchPath(href);
    return Boolean(path && isPathEnabled(path, settings.modules)
      && (!applicationId || applicationForPath(path).id === applicationId));
  }, [applicationId, settings.modules]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recent, setRecent] = useState<RecentEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSequence = useRef(0);
  const availableCommands = useMemo(() => commandsForUser(effectiveUser)
    .filter((item) => matchesScope(item.href) && (!applicationId || item.type !== "OPEN_SEARCH")), [applicationId, effectiveUser, matchesScope]);
  const allCommands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return availableCommands.filter((item) => !normalized || `${item.label} ${item.keywords.join(" ")}`.toLocaleLowerCase("vi").includes(normalized));
  }, [availableCommands, query]);
  const navigationCommands = useMemo(() => availableCommands.filter((item) => item.type !== "CREATE_ROUTE").slice(0, 5), [availableCommands]);
  const actionCommands = useMemo(() => availableCommands.filter((item) => item.type === "CREATE_ROUTE").slice(0, 4), [availableCommands]);
  const recentResults: SearchResult[] = useMemo(() => recent.filter((item) => matchesScope(item.deepLink)).slice(0, 4).map((item) => ({ ...item, reference: undefined, status: undefined, icon: "file", score: 0 })), [matchesScope, recent]);
  const isSearching = query.trim().length > 0;
  const selectable = useMemo<Selectable[]>(() => isSearching
    ? [...allCommands.slice(0, 6).map((item) => ({ kind: "command" as const, item })), ...(query.trim().length >= 2 ? results : []).map((item) => ({ kind: "result" as const, item }))]
    : [...recentResults.map((item) => ({ kind: "result" as const, item })), ...navigationCommands.map((item) => ({ kind: "command" as const, item })), ...actionCommands.map((item) => ({ kind: "command" as const, item }))], [actionCommands, allCommands, isSearching, navigationCommands, query, recentResults, results]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "/" && !open && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLSelectElement) && !(event.target instanceof HTMLElement && event.target.isContentEditable)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const releaseScrollLock = acquireBodyScrollLock();
    window.requestAnimationFrame(() => inputRef.current?.focus());
    void fetch("/api/v1/recent-items", { cache: "no-store" })
      .then((response) => response.json() as Promise<RecentBody>)
      .then((body) => setRecent(body.data?.items ?? []))
      .catch(() => setRecent([]));
    return () => {
      releaseScrollLock();
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    const requestId = ++searchSequence.current;
    if (!open || query.trim().length < 2 || searchTypes?.length === 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q: query, limit: "8" });
      if (searchTypes) params.set("types", searchTypes.join(","));
      void fetch(`/api/v1/search?${params}`, { cache: "no-store", signal: controller.signal })
        .then((response) => response.json() as Promise<SearchBody>)
        .then((body) => { if (requestId === searchSequence.current) { setResults((body.data?.results ?? []).filter((item) => matchesScope(item.deepLink))); setActive(0); } })
        .catch((reason: unknown) => { if (requestId === searchSequence.current && !(reason instanceof DOMException && reason.name === "AbortError")) setResults([]); })
        .finally(() => { if (requestId === searchSequence.current) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [matchesScope, open, query, searchTypes]);

  function selectCommand(command: AppCommand) { close(); router.push(command.href); }
  function selectActive() {
    const selected = selectable[active];
    if (!selected) {
      if (!applicationId && query.trim().length >= 2) { close(); router.push(`/search?q=${encodeURIComponent(query.trim())}`); }
      return;
    }
    if (selected.kind === "command") selectCommand(selected.item);
    else { recordRecentResult(selected.item); close(); router.push(selected.item.deepLink); }
  }

  function handleDialogKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => selectable.length ? (value + 1) % selectable.length : 0); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => selectable.length ? (value - 1 + selectable.length) % selectable.length : 0); return; }
    if (event.key === "Enter") { event.preventDefault(); selectActive(); return; }
    if (event.key === "Tab") {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,a[href]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  const commandList = (items: AppCommand[], offset: number) => (
    <ul className="command-list" role="listbox">
      {items.map((command, index) => <li aria-selected={active === offset + index} className={active === offset + index ? "is-active" : undefined} id={`command-option-${offset + index}`} key={command.key} role="option"><button onClick={() => selectCommand(command)} type="button"><Command aria-hidden="true" size={17} /><span>{command.label}</span><ArrowRight aria-hidden="true" size={16} /></button></li>)}
    </ul>
  );

  const overlay = open ? (
    <div className="command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div aria-label={searchLabel} aria-modal="true" className="command-palette" onKeyDown={handleDialogKey} ref={dialogRef} role="dialog">
        <div className="command-input-row"><Search aria-hidden="true" size={19} /><input aria-activedescendant={selectable.length ? `command-option-${active}` : undefined} aria-autocomplete="list" aria-controls="command-results" aria-expanded="true" aria-label={searchLabel} onChange={(event) => { setQuery(event.target.value); setResults([]); setActive(0); }} placeholder={applicationId ? searchLabel : "Tìm kiếm hoặc nhập lệnh"} ref={inputRef} role="combobox" value={query} /><IconButton label="Đóng" onClick={close}><X aria-hidden="true" size={18} /></IconButton></div>
        <div className="command-content" id="command-results">
          {!isSearching ? <>
            {recentResults.length ? <section><h2>Gần đây</h2><SearchResultList activeIndex={active} idPrefix="command-option" indexOffset={0} onSelect={close} results={recentResults} /></section> : null}
            {navigationCommands.length ? <section><h2>Đi nhanh</h2>{commandList(navigationCommands, recentResults.length)}</section> : null}
            {actionCommands.length ? <section><h2>Tác vụ nhanh</h2>{commandList(actionCommands, recentResults.length + navigationCommands.length)}</section> : null}
          </> : <>
            {allCommands.length ? <section><h2>Lệnh</h2>{commandList(allCommands.slice(0, 6), 0)}</section> : null}
            {query.trim().length >= 2 ? <section><h2>Kết quả</h2>{loading ? <div className="command-loading">Đang tìm…</div> : results.length ? <SearchResultList activeIndex={active - Math.min(6, allCommands.length)} idPrefix="command-option" indexOffset={Math.min(6, allCommands.length)} onSelect={close} results={results} /> : <div className="command-empty">Không tìm thấy kết quả cho “{query}”.</div>}</section> : null}
          </>}
        </div>
        <footer><span><CornerDownLeft aria-hidden="true" size={14} /> Chọn</span><span>↑↓ Di chuyển</span><span>Esc Đóng</span></footer>
      </div>
    </div>
  ) : null;

  return <><button aria-haspopup="dialog" aria-label={searchLabel} className="header-search" onClick={() => setOpen(true)} type="button"><Search aria-hidden="true" size={17} /><span>{applicationId ? "Tìm nghiệp vụ" : "Tìm kiếm"}</span><kbd>Ctrl K</kbd></button><IconButton className="header-search-mobile" label={searchLabel} onClick={() => setOpen(true)}><Search aria-hidden="true" size={19} /></IconButton>{typeof document !== "undefined" && overlay ? createPortal(overlay, document.body) : null}</>;
}
