import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const getSupabaseServiceClient = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));
vi.mock("@/features/projects/services/projectRepository", () => ({ getProject, getProjectRoster: vi.fn(async () => []) }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/features/shared-platforms/services/notificationRepository", () => ({ publishNotificationEvent: vi.fn() }));

import { adjustWorkerEntry, closeWorkerSessionDay, createWorkerSession, getWorkerSession, saveWorkerSessionDraft, submitWorkerSession } from "./workerAttendanceRepository";

const user: AuthenticatedUser = { id: "11111111-1111-4111-8111-111111111111", username: "test.supervisor", email: "supervisor@example.com", displayName: "Giám sát", status: "active", permissions: ["worker_attendance.create", "worker_attendance.view_all"] };
const sessionRow = { id: "session-1", client_session_id: "capture-1", project_id: "project-1", project_name_snapshot: "Dự án", worksite_id: "site-1", worksite_name_snapshot: "Công trường", attendance_date: "2026-10-05", shift_code: "DAY", shift_name_snapshot: "Ca ngày", session_type: "morning", supervisor_employee_id: "employee-1", supervisor_name_snapshot: "Giám sát", started_at: "2026-10-05T01:00:00Z", captured_at_client: "2026-10-05T01:00:00Z", geofence_status: "outside", latitude: 21.0278, longitude: 105.8342, accuracy_meters: 20, status: "in_progress", sync_status: "synced", photo_status: "uploaded", version: 1, worker_attendance_entries: [], worker_attendance_photos: [], worker_attendance_adjustments: [], checklist_snapshot: [], checklist_responses: [] };

type Row = Record<string, unknown>;
function database({ existing = true, referenceCoordinates = true, sessionPatch = {}, commandError }: { existing?: boolean; referenceCoordinates?: boolean; sessionPatch?: Row; commandError?: { message: string; code?: string } } = {}) {
  let saved: Row | undefined = existing ? { ...sessionRow, ...sessionPatch } : undefined;
  const mutations: Record<string, unknown>[] = [];
  const commands = vi.fn(async (name: string, input: Row) => {
    if (commandError) return { data: null, error: commandError };
    if (name === "close_worker_session_day_command" && saved?.day_closed_at) return { data: "session-1", error: null };
    const header = name === "save_worker_session_draft_command" ? { ...(input.p_header as Row), status: "in_progress", sync_status: "synced" }
      : name === "close_worker_session_day_command" ? { day_closed_at: "2026-10-05T10:00:00Z" }
      : { status: "needs_review" };
    mutations.push(header);saved = { ...saved, ...header, version: Number(saved?.version ?? 1) + 1 };
    return { data: "session-1", error: null };
  });
  const client = {
    rpc: commands,
    from(table: string) {
      let clientReplay = false;
      const query = {
        select: () => query, limit: () => query, order: () => query,
        eq: (column: string) => { if (column === "client_session_id") clientReplay = true; return query; },
        insert: (values: Record<string, unknown>) => { if (table === "worker_attendance_sessions") { mutations.push(values); saved = { ...sessionRow, ...values }; } return query; },
        update: (values: Record<string, unknown>) => { mutations.push(values); saved = { ...saved, ...values }; return query; },
        single: async () => ({ data: table === "worksites" ? { latitude: referenceCoordinates ? 10.7769 : null, longitude: referenceCoordinates ? 106.7009 : null, allowed_accuracy_threshold_meters: 100 } : { id: "session-1" }, error: null }),
        maybeSingle: async () => ({ data: table === "app_accounts" ? { id: user.id, employee_id: "employee-1", status: "active", employees: { full_name: "Giám sát" } } : table === "worker_attendance_policies" ? { minimum_photos: 0, work_note_required: false, end_of_day_required: false, offline_enabled: true, edit_window_minutes: 120 } : table === "worker_attendance_sessions" ? clientReplay ? null : saved : null, error: null }),
        then(onFulfilled: (value: unknown) => unknown) { return Promise.resolve({ data: [], error: null }).then(onFulfilled); }
      };
      return query;
    }
  };
  getSupabaseServiceClient.mockReturnValue(client);
  return Object.assign(mutations, { commands });
}

beforeEach(() => {
  getSupabaseServiceClient.mockReset();
  getProject.mockResolvedValue({ id: "project-1", name: "Dự án", status: "active", worksites: [{ id: "site-1", name: "Công trường", status: "active", gpsRequired: true, allowedAccuracyThresholdMeters: 100, radiusMeters: 10 }] });
});

const entryRow = { id: "33333333-3333-4333-8333-333333333333", session_id: "session-1", worker_id: "employee-2", employee_code_snapshot: "NV002", worker_name_snapshot: "Công nhân", assignment_role_snapshot: "worker", status: "present", day_exception: "none" };

describe("worker attendance command boundaries", () => {
  it("returns workers in the same code order regardless of database row order", async () => {
    database({ sessionPatch: { worker_attendance_entries: [{ ...entryRow, id: "entry-10", employee_code_snapshot: "CN10", status: "unconfirmed" }, { ...entryRow, id: "entry-2", employee_code_snapshot: "CN2", status: "present" }] } });
    const session = await getWorkerSession(user, "session-1");
    expect(session.entries.map(entry => entry.employeeCode)).toEqual(["CN2", "CN10"]);
  });

  it("uses a worksite address only when the recorded GPS is inside its radius", async () => {
    database({ sessionPatch: { worksites: { address: "123 Đường kiểm thử", latitude: sessionRow.latitude, longitude: sessionRow.longitude, radius_meters: 100 } } });
    await expect(getWorkerSession(user, "session-1")).resolves.toMatchObject({ worksiteAddress: "123 Đường kiểm thử" });
  });

  it.each([
    { address: "123 Đường kiểm thử", latitude: 10.7769, longitude: 106.7009, radius_meters: 100 },
    { address: "123 Đường kiểm thử", latitude: sessionRow.latitude, longitude: sessionRow.longitude, radius_meters: 0 },
    { address: "123 Đường kiểm thử", latitude: null, longitude: null, radius_meters: 100 }
  ])("does not label unrelated or unverifiable GPS as the worksite address", async worksites => {
    database({ sessionPatch: { worksites } });
    expect((await getWorkerSession(user, "session-1")).worksiteAddress).toBeUndefined();
  });

  it("sends the parent and every entry together in one draft command", async () => {
    const writes = database({ sessionPatch: { worker_attendance_entries: [entryRow] } });
    await saveWorkerSessionDraft(user, "session-1", { version: 1, entries: [{ id: entryRow.id, status: "late", dayException: "none" }], checklistResponses: [], workNote: "Thi công" });
    expect(writes.commands).toHaveBeenCalledExactlyOnceWith("save_worker_session_draft_command", expect.objectContaining({ p_session_id: "session-1", p_expected_version: 1, p_actor_id: user.id, p_header: expect.objectContaining({ work_note: "Thi công" }), p_entries: [{ id: entryRow.id, status: "late", dayException: "none" }] }));
    expect(writes).toHaveLength(1);
  });

  it("does not issue REST parent or entry writes before a failed draft command", async () => {
    const writes = database({ commandError: { message: "Database write failed" } });
    await expect(saveWorkerSessionDraft(user, "session-1", { version: 1, entries: [], checklistResponses: [] })).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(writes).toHaveLength(0);
    await expect(getWorkerSession(user, "session-1")).resolves.toMatchObject({ version: 1, status: "in_progress" });
  });

  it("does not mark the day closed before the exceptions command succeeds", async () => {
    const writes = database({ sessionPatch: { submitted_at: "2026-10-05T02:00:00Z", worker_attendance_entries: [entryRow] }, commandError: { message: "FIELD_INPUT_INVALID" } });
    await expect(closeWorkerSessionDay(user, "session-1", { version: 1, reason: "Chốt ngày", entries: [{ id: entryRow.id, dayException: "early_leave", exceptionTime: "16:00" }] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(writes).toHaveLength(0);
    await expect(getWorkerSession(user, "session-1")).resolves.toMatchObject({ version: 1, dayClosedAt: undefined });
  });

  it("keeps the existing version when an adjustment command fails", async () => {
    const writes = database({ sessionPatch: { worker_attendance_entries: [entryRow] }, commandError: { message: "FIELD_VERSION_CONFLICT" } });
    await expect(adjustWorkerEntry({ ...user, permissions: [...user.permissions, "worker_attendance.adjust"] }, "session-1", { version: 1, entryId: entryRow.id, status: "absent", reason: "Đối chiếu" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(writes.commands).toHaveBeenCalledExactlyOnceWith("adjust_worker_entry_command", expect.objectContaining({ p_expected_version: 1, p_entry_id: entryRow.id, p_status: "absent" }));
    expect(writes).toHaveLength(0);
  });

  it("denies adjustment without permission before reading the database", async () => {
    await expect(adjustWorkerEntry(user, "session-1", { version: 1, entryId: entryRow.id, status: "absent", reason: "Đối chiếu" })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(getSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("passes a closed replay to the command instead of silently discarding changed input", async () => {
    const writes = database({ sessionPatch: { submitted_at: "2026-10-05T02:00:00Z", day_closed_at: "2026-10-05T10:00:00Z", version: 2 }, commandError: { message: "FIELD_CLOSED_REPLAY_CONFLICT" } });
    await expect(closeWorkerSessionDay(user, "session-1", { version: 1, reason: "Chốt ngày", entries: [] })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(writes.commands).toHaveBeenCalledOnce();expect(writes).toHaveLength(0);
  });

  it("rejects a stale draft before invoking the command", async () => {
    const writes = database({ sessionPatch: { version: 2 } });
    await expect(saveWorkerSessionDraft(user, "session-1", { version: 1, entries: [], checklistResponses: [] })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(writes.commands).not.toHaveBeenCalled();expect(writes).toHaveLength(0);
  });
});

describe("worker attendance GPS evidence", () => {
  it.each([true, false])("accepts captured GPS regardless of reference radius or missing site coordinates (%s)", async (referenceCoordinates) => {
    const writes = database({ existing: false, referenceCoordinates });
    const result = await createWorkerSession(user, { clientSessionId: "capture-1", projectId: "project-1", worksiteId: "site-1", date: "2026-10-05", shiftCode: "DAY", sessionType: "morning", capturedAtClient: "2026-10-05T01:00:00Z", location: { latitude: 21.0278, longitude: 105.8342, accuracy: 20 } });
    expect(result.session).toMatchObject({ geofenceStatus: "valid", latitude: 21.0278, longitude: 105.8342 });
    expect(writes[0]).toMatchObject({ latitude: 21.0278, longitude: 105.8342, geofence_status: "valid" });
  });

  it("updates GPS status after retry in a previously outside session and retains low precision as evidence", async () => {
    const writes = database();
    const result = await saveWorkerSessionDraft(user, "session-1", { version: 1, entries: [], checklistResponses: [], location: { latitude: 21.0278, longitude: 105.8342, accuracy: 20000 } });
    expect(result).toMatchObject({ geofenceStatus: "accuracy_low", accuracyMeters: 20000 });
    expect(writes[0]).toMatchObject({ geofence_status: "accuracy_low", accuracy_meters: 20000 });
  });

  it("submits a historical outside-radius session with real GPS", async () => {
    const writes = database();
    await expect(submitWorkerSession(user, "session-1", 1)).resolves.toMatchObject({ status: "submitted", latitude: 21.0278 });
    expect(writes[0]).toMatchObject({ status: "submitted" });
  });
});
