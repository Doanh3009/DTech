# Employee profile and offboarding command

## Scope and rollout status

Migration: `supabase/migrations/202610220001_atomic_employee_profile.sql`.

Applied to the selected DTech development project after 88 native PostgreSQL checks and application/browser QA; see [rollout evidence](evidence/employee-rollout.json). No live offboarding or Auth provisioning was executed for acceptance. This is not a production release.

The employee PATCH path uses one database transaction for profile changes, employee history, employee audit, linked account disablement, account audit, and application session revocation. A failure in any step rolls back every step. Archiving a terminated profile is part of the same employee UPDATE, so a successful command increments its row version exactly once.

This guide describes the reviewed implementation. Remote deployment is not established by this document; see `progress.md` and the release evidence for the final target, migration hash, checks, and deployment status. Native PostgreSQL integration evidence does not replace a full Supabase rehearsal or customer UAT. No customer production deployment is authorized by a successful DTech development rollout.

## Command contract

```sql
public.patch_employee_profile_command(
  p_employee_id uuid,
  p_expected_row_version integer,
  p_patch jsonb,
  p_actor_id uuid,
  p_event_date date,
  p_reason text default null
) returns integer
```

The return value is the committed employee row version. The expected version is mandatory, from `1` through `2147483646`; callers must use the version read with the edited profile. The HTTP response is `{ employeeId, rowVersion }`. It does not perform a separate post-commit employee read or application audit write.

`p_actor_id` comes from the authenticated application account. The database independently requires an active account and the permissions below after acquiring the lifecycle lock.

| Patch | Required permission |
| --- | --- |
| General profile fields or a non-terminated employment status | `employee.edit` |
| Status set to `terminated`, termination date, or termination reason | `employee.offboard` |
| General profile fields together with termination fields | Both permissions |

An offboarding-only actor does not also need `account.disable`; the profile command owns that coordinated access change. The independent account status endpoint still requires `account.enable` or `account.disable`. Role replacement requires `account.assign_role`; provisioning requires `account.create`.

## Fields and validation

The HTTP schema and database reject unknown profile fields. Sensitive identity, banking, and emergency contact fields belong to their separate endpoints. Callers cannot supply the archived profile status directly.

Omitting a field preserves its current value. Explicit JSON `null` clears an optional field. Required fields cannot be cleared: employee code, full name, department, position, employment type, join date, and employment status.

Optional fields include display name, birth date, gender, personal phone, personal/company email, manager, probation/official dates, addresses, province, contractor name, marital status, note, and termination metadata. A terminated employee must retain a non-null termination date and a trimmed reason of 3–500 characters. The HTTP schema requires both values when explicitly submitting `employmentStatus: "terminated"`.

Dates use real calendar dates in `YYYY-MM-DD` format. The database validates the merged stored profile, including an official or termination date before the join date and a probation end date before its start. Changing one date cannot bypass validation by omitting its counterpart.

Phone clearing clears both stored phone columns. The database derives the normalized phone from the supplied phone and rejects an inconsistent explicitly supplied normalized value. UUID references, JSON value types, allowed enum values, and database uniqueness/reference constraints remain enforced.

New department, position, and employment-type assignments must select active catalog entries. A newly assigned manager must have active employment status and an unarchived profile; the manager chain must not contain this employee or any existing cycle. An unchanged current reference is preserved even if it has since become inactive, including when explicitly submitted with the same ID. Clearing an optional manager assignment is permitted. The shared lifecycle lock serializes manager changes made through this command.

Changing a terminated employee back to another employment status is rejected with `EMPLOYEE_REHIRE_REQUIRED`. Rehire needs a separate approved business policy and command; it is not implemented by editing a status. Provisioning or enabling an account for a terminated or archived employee is rejected.

## Transaction, locking, and access

These commands acquire the shared transaction advisory lock first:

```text
hashtextextended('dtech:account-lifecycle-command', 0)
```

Profile changes then lock the employee row and disable linked accounts in UUID order. Account status changes lock the linked employee before the target account. Provisioning locks the employee before inserting its account. Role replacement locks its target account. Permission checks occur after the advisory lock. The status and role commands enforce the final active administrator rule within this protocol.

This protocol is designed and exercised for the Supabase/PostgREST `READ COMMITTED` transaction isolation setting. External writers must adopt the same lock order and must not override isolation without a separate concurrency review. Direct table writes do not inherit command protections.

Public command functions use `SECURITY DEFINER`, an empty `search_path`, schema-qualified application objects, and service-role-only execution. `apply_app_account_status_locked` is an owner-only implementation helper; execution is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`. It cannot be called with the service credential to skip actor checks or locks. Supabase default grants are simulated in the native ACL checks.

Only application sessions in `app_sessions` are revoked. The command retains the Supabase Auth identity and employee history. Request authentication also checks the account's current active status, so an old Auth token does not restore access to a disabled application account.

## Errors and uncertain retries

| Database result | HTTP behavior |
| --- | --- |
| `EMPLOYEE_NOT_FOUND` | 404 |
| `EMPLOYEE_ACTOR_FORBIDDEN` | 403 |
| `EMPLOYEE_INVALID_PATCH`, `EMPLOYEE_INVALID_DATES`, `EMPLOYEE_OFFBOARD_DETAILS_REQUIRED` | 400 |
| `EMPLOYEE_VERSION_CONFLICT`, `LAST_ACTIVE_ADMIN`, `EMPLOYEE_REHIRE_REQUIRED` | 409 |
| Duplicate unique value / invalid reference or constraint | 409 / 400 |
| Missing command migration, transport failure, or unknown database outcome | 503 |

There is no receipt table or request identifier in this slice. CAS prevents repeating a committed edit: an authorized retry with its original version produces 409 and adds no history or access changes. Self-offboarding also revokes the actor's own access, so a later request may require another authorized administrator. A 503 may mean that the database committed but the response was lost. Reload the profile and history, reconcile the result, and explicitly choose any remaining edit. Do not automatically replace the expected version or fall back to direct writes. Do not treat a failed response as proof that the transaction rolled back.

Account commands also reject inactive/unauthorized actors and return `ACCOUNT_EMPLOYEE_INACTIVE` when enabling/provisioning an ineligible employee.

## History and privacy

Employee history retains actual before/after values for the affected profile columns and the row versions. These values can include personal contact, address, and birth-date data. They require the same access controls, export policy, retention policy, and backup protection as the employee profile. Application logs and release evidence must not copy those values.

Employee audit entries contain row version, employment status, and changed field names; they avoid duplicating profile values. Linked account audit entries record status changes. A history or audit failure aborts the profile command.

## Verification and deployment

The isolated native suite is `supabase/tests/atomic-employee.integration.mjs`; its fixture assembles the relevant actual migrations and account/session/history constraints. Install the temporary PostgreSQL dependencies described in `supabase/tests/atomic-employee.README.md`, then run `node supabase/tests/atomic-employee.integration.mjs`. Retain the generated evidence under `docs/commercial-erp/evidence/`. Check the current evidence for the exact number of checks and source hashes.

Required evidence includes successful edits, explicit null clearing, stale-version rejection, mixed permissions, merged date validation, terminal state protection, final-administrator rollback, history/audit failure rollback, session revocation, helper ACLs under default grants, and concurrent offboarding/status/role/provisioning cases. Synthetic employee/account cases run only in the disposable local database.

Before an additive development migration rollout, compare the migration hash to passing native evidence; verify the exact linked DTech development project `tcjjhxqtreemccdbvyza` and reviewed deployment manifest; inspect a migration dry run and apply only the reviewed pending migration. Use read-only metadata checks afterward. Do not offboard the real development administrator or create operational fixtures on the cloud project to demonstrate this feature.

Rollback uses a reviewed forward migration or application release with a compatible command contract. Do not drop employee history, audit rows, or identities. Reverting the application to split direct writes would remove the integrity guarantee and requires an explicit release decision.

## Remaining work

The later `202610220002` account lifecycle and `202610220003` auxiliary migrations have been applied to DTech development; see [rollout evidence](evidence/lifecycle-rollout.json). They replace the earlier deletion/compensation, sensitive/archive and session-insert gaps with durable account recovery, explicit cleanup, atomic employee commands sharing the profile version, and the active-account session INSERT guard. The native lifecycle suite has 165 checks with a minimal Auth stub; it does not establish real GoTrue create/delete acceptance. See [account recovery](account-lifecycle-recovery-guide.md) and [sensitive/archive](employee-auxiliary-command-guide.md).

Recovery is available on `/settings/users` and inline in the employee Account tab. Existing employee/tab access rules still apply; an actor with `account.create` or `account.delete` can recover that employee's operations there without additionally obtaining `user.view`.

- Identity document upload/remove still combines object storage and profile links outside these commands; storage ownership and recovery need their own workflow review.
- Rehire, emergency contacts, employee creation and other direct writers need separate business/integrity review.
- Real Supabase/GoTrue create/delete and managed-trigger rehearsal, backup restoration, customer isolation/UAT and production release evidence remain incomplete.
- Retention/erasure for operation payloads, tombstones, history and free-form reasons is not automated. Do not purge recovery bindings without reviewing delayed-Auth/replay protections.
