"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Input, PasswordInput } from "@/components/shared/FormControls";
import { ACCOUNT_PASSWORD_HTML_PATTERN, ACCOUNT_PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";
import { usernameHtmlPattern } from "@/lib/auth/username";

export function postLoginDestination(data: { redirectTo?: string; mobileRedirectTo?: string } | undefined, mobile: boolean): string {
  return mobile ? data?.mobileRedirectTo || "/personal" : data?.redirectTo || "/dashboard";
}

export function LoginForm() {
  const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    if (submitting) { event.preventDefault(); return; }
    event.preventDefault(); setSubmitting(true); setError(""); const form = new FormData(event.currentTarget);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/v1/auth/login", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      const body = await response.json().catch(() => undefined) as { data?: { redirectTo?: string; mobileRedirectTo?: string }; error?: { message?: string } } | undefined;
      if (!body) throw new Error("Đăng nhập tạm thời gián đoạn. Vui lòng thử lại.");
      if (!response.ok) throw new Error(body.error?.message || "Không thể đăng nhập.");
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      window.location.assign(postLoginDestination(body.data, mobile));
    } catch (cause) {
      setError(controller.signal.aborted ? "Kết nối quá lâu. Vui lòng thử lại." : cause instanceof TypeError ? "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại." : cause instanceof Error ? cause.message : "Không thể đăng nhập.");
      setSubmitting(false);
    } finally { clearTimeout(timeout); }
  }
  return <form aria-busy={submitting} method="post" onSubmit={submit}><Input autoCapitalize="none" autoComplete="username" label="Tên tài khoản" name="username" pattern={usernameHtmlPattern} required /><PasswordInput autoComplete="current-password" label="Mật khẩu" minLength={ACCOUNT_PASSWORD_MIN_LENGTH} name="password" pattern={ACCOUNT_PASSWORD_HTML_PATTERN} required />{error ? <p className="form-error" ref={errorRef} role="alert" tabIndex={-1}>{error}</p> : null}<Button disabled={submitting} type="submit" variant="primary" busy={submitting}>{"Đăng nhập"}</Button></form>;
}
