import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: vi.fn() }));
import { useImportExportData } from "./importExportClient";

const response = (data: unknown) => ({ ok: true, json: async () => ({ data }) });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("import export data continuity", () => {
  it("keeps loaded data visible during refresh and when a refresh fails", async () => {
    let finish: (value: ReturnType<typeof response>) => void = () => undefined;
    const fetch = vi.fn().mockResolvedValueOnce(response({ number: "SHP-1" })).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useImportExportData<{ number: string }>("/one"));
    await waitFor(() => expect(result.current.data?.number).toBe("SHP-1"));
    let refresh: Promise<unknown>;
    act(() => { refresh = result.current.reload(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.data?.number).toBe("SHP-1");
    await act(async () => { finish(response({ number: "SHP-2" })); await refresh; });
    fetch.mockRejectedValueOnce(new Error("Offline"));
    await act(async () => { await result.current.reload(); });
    expect(result.current.data?.number).toBe("SHP-2");
    expect(result.current.error).toBe("Offline");
    expect(result.current.loading).toBe(false);
  });

  it("ignores a delayed response belonging to a different shipment", async () => {
    let finishOld: (value: ReturnType<typeof response>) => void = () => undefined;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValueOnce(response({ number: "NEW" }));
    vi.stubGlobal("fetch", fetch);
    const { result, rerender } = renderHook(({ url }) => useImportExportData<{ number: string }>(url), { initialProps: { url: "/old" } });
    rerender({ url: "/new" });
    await waitFor(() => expect(result.current.data?.number).toBe("NEW"));
    await act(async () => { finishOld(response({ number: "OLD" })); });
    expect(result.current.data?.number).toBe("NEW");
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
