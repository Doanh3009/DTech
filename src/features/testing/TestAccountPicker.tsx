"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { FormField, PasswordInput } from "@/components/shared/FormControls";
import { postLoginDestination } from "@/features/auth/components/LoginForm";
import { useLoadingActivity } from "@/lib/ui/useLoadingActivity";
import styles from "./TestAccountPicker.module.css";

type TestAccount = { username: string; label: string; status: string };
type TesterResponse<T> = { data?: T; error?: { message?: string } };
type LoginDestination = { redirectTo?: string; mobileRedirectTo?: string };

class TesterRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function testerRequest<T>(url: string, controller: AbortController, init?: RequestInit, timeoutMs = 12_000) {
  const timeout = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin", signal: controller.signal });
    if (response.status === 401 && !init?.method) return { locked: true as const };
    const body = await response.json().catch(() => undefined) as TesterResponse<T> | undefined;
    if (!body) throw new Error("Kết nối kiểm thử bị gián đoạn. Vui lòng thử lại.");
    if (!response.ok) throw new TesterRequestError(body.error?.message || "Không thể mở tài khoản kiểm thử.", response.status);
    return { locked: false as const, data: body.data };
  } catch (cause) {
    if (controller.signal.reason === "timeout") throw new Error("Kết nối quá lâu. Vui lòng thử lại.");
    if (cause instanceof TypeError) throw new Error("Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.");
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function TestAccountPicker({ environment, currentUsername, compact = false, standalone = false }: { environment: string; currentUsername?: string; compact?: boolean; standalone?: boolean }) {
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  const [accessState, setAccessState] = useState<"loading" | "locked" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [loginUsername, setLoginUsername] = useState<string | null>(null);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const mutationRef = useRef(false);
  const mountedRef = useRef(false);
  const invitationRef = useRef<string | null>(null);
  useLoadingActivity(accessState === "loading" || busy);
  const beginRequest = useCallback(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    return controller;
  }, []);
  const load = useCallback(async () => {
    const controller = beginRequest();
    setAccessState("loading"); setError("");
    try {
      const result = await testerRequest<TestAccount[]>("/api/testing/accounts", controller);
      if (controller.signal.aborted) return;
      if (result.locked) { setAccounts([]); setAccessState("locked"); return; }
      if (!Array.isArray(result.data) || result.data.some((account) => !account || typeof account.username !== "string" || typeof account.label !== "string" || typeof account.status !== "string")) throw new Error("Danh sách tài khoản chưa tải được. Vui lòng thử lại.");
      setAccounts(result.data); setAccessState("ready");
    } catch (cause) {
      if (!mountedRef.current || requestRef.current !== controller || (controller.signal.aborted && controller.signal.reason !== "timeout")) return;
      setError(cause instanceof Error ? cause.message : "Không thể kết nối"); setAccessState("error");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [beginRequest]);
  const initialize = useCallback(async () => {
    const token = invitationRef.current;
    if (!token) { await load(); return; }
    const controller = beginRequest();
    setAccessState("loading"); setError("");
    try {
      await testerRequest("/api/testing/access", controller, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      if (controller.signal.aborted) return;
      invitationRef.current = null;
      await load();
    } catch (cause) {
      if (!mountedRef.current || requestRef.current !== controller || (controller.signal.aborted && controller.signal.reason !== "timeout")) return;
      setError(cause instanceof Error ? cause.message : "Không thể mở kiểm thử.");
      const rejected = cause instanceof TesterRequestError && (cause.status === 401 || cause.status === 403);
      if (rejected) invitationRef.current = null;
      setAccessState(rejected ? "locked" : "error");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [beginRequest, load]);
  useEffect(() => {
    mountedRef.current = true;
    if (standalone) {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("access");
      if (token !== null) {
        invitationRef.current = token;
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      }
    }
    let active = true;
    queueMicrotask(() => { if (active) void initialize(); });
    return () => {
      active = false; mountedRef.current = false;
      requestRef.current?.abort(); requestRef.current = null;
      mutationRef.current = false;
    };
  }, [initialize, standalone]);
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationRef.current) return;
    mutationRef.current = true;
    const controller = beginRequest();
    setBusy(true); setError("");
    const secret = new FormData(event.currentTarget).get("testerSecret");
    try {
      await testerRequest("/api/testing/access", controller, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret }) });
      if (controller.signal.aborted) return;
      await load();
    } catch (cause) { if (mountedRef.current && (!controller.signal.aborted || controller.signal.reason === "timeout")) setError(cause instanceof Error ? cause.message : "Không thể kết nối"); }
    finally {
      if (requestRef.current === controller) requestRef.current = null;
      mutationRef.current = false; if (mountedRef.current) setBusy(false);
    }
  }
  async function login(username: string) {
    if (mutationRef.current) return;
    mutationRef.current = true;
    const controller = beginRequest();
    setBusy(true); setLoginUsername(username); setError("");
    let navigating = false;
    try {
      const result = await testerRequest<LoginDestination>("/api/testing/login", controller, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username }) }, 20_000);
      if (controller.signal.aborted) return;
      if (result.locked || !result.data || (typeof result.data.redirectTo !== "string" && typeof result.data.mobileRedirectTo !== "string")) throw new Error("Không chuyển được tài khoản. Vui lòng thử lại.");
      window.location.assign(postLoginDestination(result.data, window.matchMedia("(max-width: 767px)").matches));
      navigating = true;
    } catch (cause) {
      if (mountedRef.current && (!controller.signal.aborted || controller.signal.reason === "timeout")) setError(cause instanceof Error ? cause.message : "Không thể kết nối");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!navigating) {
        mutationRef.current = false;
        if (mountedRef.current) { setBusy(false); setLoginUsername(null); }
      }
    }
  }
  return <section className={`test-account-picker${compact ? " test-account-picker--compact" : ""}${standalone ? ` ${styles.picker}` : ""}`} aria-label="Tài khoản kiểm thử">
    <header>{standalone ? <h2>Tài khoản kiểm thử</h2> : <strong>{compact ? "Đang kiểm thử" : "TÀI KHOẢN KIỂM THỬ"}</strong>}<span className="badge badge--info">{environment.toUpperCase()}</span>{standalone ? <span className={styles.databaseBadge}>Cơ sở dữ liệu kiểm thử</span> : null}{currentUsername ? <span>{currentUsername}</span> : null}</header>
    {accessState === "loading" ? <div className="test-account-picker__loading" role="status" aria-live="polite" aria-label="Đang tải tài khoản kiểm thử"><span>Đang tải tài khoản kiểm thử</span></div> : null}
    {accessState === "ready" ? <div className={standalone ? styles.accounts : "test-account-picker__accounts"}>
      {standalone && accounts.length ? <table className={styles.table} aria-label="Danh sách tài khoản kiểm thử" aria-busy={busy || undefined}>
        <thead><tr><th scope="col">Vai trò</th><th scope="col">Tài khoản</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{accounts.map((account) => <tr key={account.username} data-active={account.status === "active" && !busy ? "true" : undefined} className={account.username === currentUsername ? styles.current : undefined} onClick={(event) => {
          if (!(event.target as Element).closest("button") && !busy && account.status === "active") void login(account.username);
        }}>
          <th scope="row" data-label="Vai trò">{account.label}</th>
          <td data-label="Tài khoản"><span className={styles.username}>{account.username}</span></td>
          <td data-label="Trạng thái"><span className={`badge ${account.status === "active" ? "badge--success" : "badge--neutral"}`}>{account.status === "active" ? "Sẵn sàng" : "Đã khóa"}</span>{account.username === currentUsername ? <span className={styles.currentLabel}>Đang dùng</span> : null}</td>
          <td data-label="Thao tác"><Button variant="primary" disabled={busy || account.status !== "active"} aria-label={`Vào test ${account.label}`} busy={busy && loginUsername === account.username} onClick={() => void login(account.username)}>{loginUsername === account.username ? "Đang vào…" : "Vào test"}</Button></td>
        </tr>)}</tbody>
      </table> : compact && accounts.length ? <FormField disabled={busy} label="Chuyển tài khoản kiểm thử">
        {(fieldId) => <select aria-busy={busy || undefined} className="select" disabled={busy} id={fieldId} name="testAccount" onChange={(event) => {
          const username = event.currentTarget.value;
          if (!busy && username !== currentUsername && accounts.some((account) => account.username === username && account.status === "active")) void login(username);
        }} value={accounts.some((account) => account.username === currentUsername) ? currentUsername : ""}>
          <option disabled value="">Chọn tài khoản</option>
          {accounts.map((account) => <option disabled={account.status !== "active"} key={account.username} value={account.username}>{account.label}</option>)}
        </select>}
      </FormField> : !compact ? accounts.map((account) => <Button key={account.username} disabled={busy || account.status !== "active"} onClick={() => login(account.username)} variant={account.username === currentUsername ? "primary" : "secondary"}>{account.label}</Button>) : null}
      {!accounts.length ? <span>Chưa có tài khoản kiểm thử</span> : null}
    </div> : null}
    {accessState === "locked" ? <form onSubmit={unlock}><PasswordInput name="testerSecret" label="Mã truy cập tester" required autoComplete="off" /><Button type="submit" disabled={busy}>Mở kiểm thử</Button></form> : null}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {accessState === "error" ? <Button disabled={busy} onClick={() => void initialize()}>Thử lại</Button> : null}
  </section>;
}
