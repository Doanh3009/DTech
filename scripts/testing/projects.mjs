import assert from "node:assert/strict";
import { fixedId, check } from "./accounts.mjs";
import { TEST_OWNER } from "../../src/lib/testing/policy.mjs";
import { seedFieldPhoto } from "./assets.mjs";
export const projectIds = ["A", "B", "C"].map((name) => fixedId(`project:${name}`));
async function assertChild(db, table, id, expected) {
  const old = await check(db.from(table).select(Object.keys(expected).join(",")).eq("id", id).maybeSingle(), `${table} collision`);
  assert(!old || Object.entries(expected).every(([key, value]) => old[key] === value), `Không ghi đè ${table} ngoài phạm vi seed`);
}
export async function seedProjects(db) {
  const today = new Date().toISOString().slice(0, 10);
  const actor = fixedId("account:admin.test"), manager = fixedId("employee:manager.test");
  const [departments, positions, types] = await Promise.all([check(db.from("departments").select("id,code"), "worker department"), check(db.from("positions").select("id,code"), "worker position"), check(db.from("employment_types").select("id,code"), "worker type")]);
  const workerReferences = { department_id: departments.find((row) => row.code === "construction")?.id, position_id: positions.find((row) => row.code === "worker")?.id, employment_type_id: types.find((row) => row.code === "worker")?.id };
  assert(Object.values(workerReferences).every(Boolean), "Thiếu danh mục công nhân");
  for (const [index, name] of ["A", "B", "C"].entries()) {
    const id = projectIds[index], siteId = fixedId(`site:${name}`);
    const note = `[TEST:${TEST_OWNER}] project:${name}`;
    const old = await check(db.from("projects").select("note").eq("id", id).maybeSingle(), "project collision");
    assert(!old || old.note === note, "Không ghi đè dự án ngoài phạm vi test");
    await check(db.from("projects").upsert({ id, code: `QA-PACKAGE-${name}`, name: `[TEST] Gói công trường ${name}`, customer_name: "Đối tác giả lập", start_date: "2026-01-01", status: index === 2 ? "completed" : "active", project_manager_employee_id: manager, note, created_by: actor }, { onConflict: "id" }), "seed project");
    await assertChild(db, "worksites", siteId, { project_id: id, note });
    await check(db.from("worksites").upsert({ id: siteId, project_id: id, name: `[TEST] Khu thi công ${name}`, gps_required: false, note, created_by: actor }, { onConflict: "id" }), "seed worksite");
    if (index === 2) continue;
    const engineer = index === 0 ? "engineer.test" : "engineer02.test";
    for (const [username, role] of [[engineer, "supervisor_main"], ["manager.test", "project_manager"]]) {
      const assignmentId = fixedId(`assignment:${name}:${username}`);
      await assertChild(db, "project_assignments", assignmentId, { project_id: id, employee_id: fixedId(`employee:${username}`) });
      await check(db.from("project_assignments").upsert({ id: assignmentId, project_id: id, worksite_id: siteId, employee_id: fixedId(`employee:${username}`), assignment_role: role, start_date: "2026-01-01", status: "active", assigned_by: actor }, { onConflict: "id" }), "seed assignment");
    }
    for (let number = 1; number <= 5; number++) {
      const workerId = fixedId(`worker:${name}:${number}`), workerNote = `[TEST:${TEST_OWNER}] worker:${name}:${number}`;
      const oldWorker = await check(db.from("employees").select("note").eq("id", workerId).maybeSingle(), "worker collision");
      assert(!oldWorker || oldWorker.note === workerNote, "Không ghi đè công nhân ngoài phạm vi test");
      await check(db.from("employees").upsert({ id: workerId, employee_code: `QA_WORKER_${name}_${number}`, full_name: `[TEST] Công nhân ${name}${number}`, personal_phone: "", normalized_phone: `QA:worker:${name}:${number}`, ...workerReferences, join_date: "2026-01-01", employment_status: "active", profile_status: "complete", profile_completeness: 100, note: workerNote, manager_employee_id: manager, created_by: actor }, { onConflict: "id" }), "seed worker");
      const assignmentId = fixedId(`assignment:${name}:worker:${number}`);
      await assertChild(db, "project_assignments", assignmentId, { project_id: id, employee_id: workerId });
      await check(db.from("project_assignments").upsert({ id: assignmentId, project_id: id, worksite_id: siteId, employee_id: workerId, assignment_role: "worker", start_date: "2026-01-01", status: "active", assigned_by: actor }, { onConflict: "id" }), "seed worker roster");
    }
    for (const [item, status, completion] of [["Khảo sát", "completed", 100], ["Thi công", "in_progress", index ? 42 : 65], ["Nghiệm thu", "not_started", 0]]) {
      const nodeId = fixedId(`progress:${name}:${item}`);
      await assertChild(db, "project_progress_nodes", nodeId, { project_id: id, created_by: actor });
      await check(db.from("project_progress_nodes").upsert({ id: nodeId, project_id: id, node_type: "phase", name: `[TEST] ${item}`, status, completion_percent: completion, created_by: actor }, { onConflict: "id" }), "seed progress");
    }
    const updateId = fixedId(`update:${name}`), engineerId = fixedId(`account:${engineer}`);
    await assertChild(db, "project_updates", updateId, { project_id: id, created_by: engineerId });
    await check(db.from("project_updates").upsert({ id: updateId, client_update_id: fixedId(`client-update:${name}`), project_id: id, project_name_snapshot: `[TEST] Gói công trường ${name}`, worksite_id: siteId, worksite_name_snapshot: `[TEST] Khu thi công ${name}`, author_employee_id: fixedId(`employee:${engineer}`), author_name_snapshot: `[TEST] ${engineer}`, author_project_role_snapshot: "supervisor_main", update_type: "progress", title: `[TEST] Báo cáo hiện trường ${name}`, content: `Đã hoàn tất kiểm tra vật tư, an toàn và tiến độ công trường ${name}. Dữ liệu giả lập.`, status: "in_progress", publish_status: "published", created_by: engineerId, captured_at_client: `${today}T01:00:00Z` }, { onConflict: "id", ignoreDuplicates: true }), "seed field report");
    await seedFieldPhoto(db, name, updateId, engineerId);
    const issueUpdateId = fixedId(`issue-update:${name}`), issueId = fixedId(`issue:${name}`);
    await assertChild(db, "project_updates", issueUpdateId, { project_id: id, created_by: engineerId });
    await assertChild(db, "project_issues", issueId, { project_id: id, source_update_id: issueUpdateId });
    await check(db.from("project_updates").upsert({ id: issueUpdateId, client_update_id: fixedId(`client-issue:${name}`), project_id: id, project_name_snapshot: `[TEST] Gói công trường ${name}`, worksite_id: siteId, worksite_name_snapshot: `[TEST] Khu thi công ${name}`, author_employee_id: fixedId(`employee:${engineer}`), author_name_snapshot: `[TEST] ${engineer}`, author_project_role_snapshot: "supervisor_main", update_type: "issue", title: `[TEST] Chờ vật tư gói ${name}`, content: "Vật tư giả lập chưa đến công trường; cần điều phối lịch giao và kiểm tra tiến độ.", status: "waiting", created_by: engineerId }, { onConflict: "id", ignoreDuplicates: true }), "seed issue report");
    await check(db.from("project_issues").upsert({ id: issueId, project_id: id, worksite_id: siteId, source_update_id: issueUpdateId, title: `[TEST] Chờ vật tư gói ${name}`, severity: index ? "medium" : "high", status: "open", owner_employee_id: fixedId(`employee:${engineer}`) }, { onConflict: "id", ignoreDuplicates: true }), "seed project issue");
  }
  console.log("READY 2 gói đang thi công + 1 gói hoàn thành; hai kỹ sư có phạm vi khác nhau");
}
export async function verifyProjects(db) {
  const projects = await check(db.from("projects").select("id,note,status").in("id", projectIds), "verify projects");
  assert.equal(projects.length, 3); assert(projects.every((row) => row.note.startsWith(`[TEST:${TEST_OWNER}]`)));
  const assignments = await check(db.from("project_assignments").select("project_id,employee_id,status").in("project_id", projectIds), "verify assignments");
  for (const [index, username] of ["engineer.test", "engineer02.test"].entries()) {
    const assigned = assignments.filter((row) => row.employee_id === fixedId(`employee:${username}`) && row.status === "active");
    assert.deepEqual(assigned.map((row) => row.project_id), [projectIds[index]]);
  }
  for (const [index, name] of ["A", "B"].entries()) assert.equal(assignments.filter((row) => row.project_id === projectIds[index] && Array.from({ length: 5 }, (_, number) => fixedId(`worker:${name}:${number + 1}`)).includes(row.employee_id)).length, 5);
  const issues = await check(db.from("project_issues").select("id").in("id", ["A", "B"].map((name) => fixedId(`issue:${name}`))), "verify issues");
  const photos = await check(db.from("project_update_attachments").select("id").in("id", ["A", "B"].map((name) => fixedId(`field-attachment:${name}`))), "verify photos");
  assert.equal(issues.length, 2); assert.equal(photos.length, 2);
  console.log("PASS phạm vi riêng của hai kỹ sư; dự án và phân công đủ dữ liệu");
}
