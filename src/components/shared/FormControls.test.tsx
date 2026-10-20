import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Input, PasswordInput, Select, Switch } from "@/components/shared/FormControls";

describe("FormControls", () => {
  it("keeps a compact select label accessible when it is visually hidden", () => {
    const { container } = render(
      <Select
        label="Phòng ban"
        labelHidden
        options={[{ label: "Nhân sự", value: "hr" }]}
        placeholder="Phòng ban: Tất cả"
      />
    );

    expect(screen.getByLabelText("Phòng ban")).toBeInTheDocument();
    expect(container.querySelector(".sr-only")).toHaveTextContent("Phòng ban");
  });

  it("toggles password visibility without submitting or clearing the value", () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={submit}><PasswordInput label="Mật khẩu" name="password" defaultValue="Secret123" /></form>);
    const input = screen.getByLabelText("Mật khẩu") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Hiển thị mật khẩu" }));
    expect(input.type).toBe("text");
    expect(input.value).toBe("Secret123");
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
    expect(input.type).toBe("password");
  });

  it("keeps custom ids linked to labels, helper text and inline errors", () => {
    render(
      <Input
        error="Mã đã tồn tại"
        helperText="Dùng mã nội bộ"
        id="employee-code"
        label="Mã nhân viên"
        required
      />
    );

    const input = screen.getByRole("textbox", { name: "Mã nhân viên" });
    expect(input).toHaveAttribute("id", "employee-code");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "employee-code-helper employee-code-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Mã đã tồn tại");
  });

  it("exposes distinct read-only, disabled and switch helper states", () => {
    render(
      <>
        <Input defaultValue="CT-001" label="Mã chứng từ" readOnly />
        <Input defaultValue="VND" disabled label="Loại tiền" />
        <Switch checked helperText="Áp dụng cho chứng từ hợp lệ" label="Tự động duyệt" />
      </>
    );

    expect(screen.getByLabelText("Mã chứng từ")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Mã chứng từ")).not.toBeDisabled();
    expect(screen.getByLabelText("Loại tiền")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Tự động duyệt" })).toHaveAccessibleDescription("Áp dụng cho chứng từ hợp lệ");
  });
});
