import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttendanceHistory } from "./AttendanceHistory";

afterEach(() => vi.unstubAllGlobals());

describe("personal attendance calendar", () => {
  it("opens a day without check-in or check-out records", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }));

    render(<AttendanceHistory selectedDate={undefined} />);

    const today = new Date();
    const firstDay = `01/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    const day = await waitFor(() => screen.getByRole("button", { name: `${firstDay}, chưa có lượt chấm` }));
    fireEvent.click(day);

    expect(screen.getByText("Chưa có lượt chấm công.")).toBeInTheDocument();
    expect(screen.getByText("Giờ vào")).toBeInTheDocument();
    expect(screen.getByText("Giờ ra")).toBeInTheDocument();
  });
});
