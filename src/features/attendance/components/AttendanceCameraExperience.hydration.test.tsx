import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { AttendanceCameraExperience } from "./AttendanceCameraExperience";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: vi.fn() }));
vi.mock("@/lib/ui/useLoadingActivity", () => ({ useLoadingActivity: vi.fn() }));
vi.mock("@/features/attendance/client/attendanceQueue", () => ({
  countPendingAttendance: vi.fn().mockResolvedValue(0), listPendingAttendance: vi.fn().mockResolvedValue([]), savePendingAttendance: vi.fn()
}));

const user: AuthenticatedUser = {
  id: "clock-fixture", username: "clock-fixture", displayName: "Đồng hồ mẫu", email: "clock@example.invalid", status: "active", permissions: ["attendance.self.create"]
};

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("attendance clock hydration", () => {
  it("hydrates a stable placeholder before showing the current Vietnam business date and time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    vi.setSystemTime(new Date("2026-10-14T05:00:00Z"));
    const element = <CurrentUserProvider user={user}><AttendanceCameraExperience /></CurrentUserProvider>;
    const serverHtml = renderToString(element);
    expect(serverHtml).toContain("--:--");
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.append(container);
    const recoverableErrors = vi.fn();
    vi.setSystemTime(new Date("2026-10-14T17:05:00Z"));
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, element, { onRecoverableError: recoverableErrors }); });
      expect(recoverableErrors).not.toHaveBeenCalled();
      expect(container.textContent).toContain("00:05");
      expect(container.textContent).toContain("15/10/2026");
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});
