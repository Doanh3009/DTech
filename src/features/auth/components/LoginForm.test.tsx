import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm, postLoginDestination } from "./LoginForm";

afterEach(() => vi.unstubAllGlobals());

describe("LoginForm", () => {
  it("uses POST as the native fallback so credentials never enter the URL", () => {
    render(<LoginForm />);

    expect(screen.getByRole("button", { name: "Đăng nhập" }).closest("form")).toHaveAttribute("method", "post");
  });

  it("opens personal home on phones and preserves role landing on desktop", () => {
    const result = { redirectTo: "/dashboard", mobileRedirectTo: "/personal" };
    expect(postLoginDestination(result, true)).toBe("/personal");
    expect(postLoginDestination(result, false)).toBe("/dashboard");
  });

  it("keeps credentials and focuses a readable error when the server returns HTML", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.reject(new SyntaxError("Unexpected token '<'")) }));
    render(<LoginForm />);
    const username = screen.getByLabelText(/Tên tài khoản/);
    const password = screen.getByLabelText(/^Mật khẩu/);
    fireEvent.change(username, { target: { value: "test.employee" } });
    fireEvent.change(password, { target: { value: "test-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập" }).closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Đăng nhập tạm thời gián đoạn. Vui lòng thử lại.");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(username).toHaveValue("test.employee");
    expect(password).toHaveValue("test-password");
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
  });

  it("offers a retry after a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<LoginForm />);
    fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.");
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
  });
});
