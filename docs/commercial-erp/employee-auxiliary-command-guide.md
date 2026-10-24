# Sensitive employee data and standalone archival

## Scope and release status

Migration: `supabase/migrations/202610220003_atomic_employee_auxiliary.sql`.

The migration has been applied to the selected DTech development project together with account lifecycle migration `202610220002`; see [rollout evidence](evidence/lifecycle-rollout.json) for source hashes, target and checks. The native lifecycle suite has 165 checks with an Auth stub, not a live Supabase/GoTrue create/delete rehearsal. Consult [progress](progress.md) and final QA evidence for overall readiness; this is not a production release. Synthetic employee/account cases belong in the disposable native PostgreSQL fixture. Do not archive the real development administrator for acceptance.

These commands extend the shared employee version used by [profile and offboarding](employee-profile-command-guide.md). Each successful command changes data, increments `employees.row_version` once, writes employee history and writes audit in one transaction. A failure in any step rolls back the entire command.

## Command contracts

```sql
public.patch_employee_sensitive_command(
  p_employee_id uuid,
  p_expected_row_version integer,
  p_patch jsonb,
  p_actor_id uuid,
  p_event_date date,
  p_reason text default null
) returns integer

public.archive_employee_command(
  p_employee_id uuid,
  p_expected_row_version integer,
  p_actor_id uuid,
  p_event_date date,
  p_reason text
) returns integer
```

The return value is the committed employee row version. Callers pass the version read with the employee detail/list; valid expected values are `1` through `2147483646`. Actor identity comes from the authenticated application account. Event dates are real, finite calendar dates from `0001-01-01` through `9999-12-31`. Both commands require a trimmed reason of 3–500 characters.

| Command | Database permission |
| --- | --- |
| Sensitive correction | `employee.edit_sensitive` |
| Standalone archive | `employee.archive` |

The database independently checks that the actor is active and has the exact permission after acquiring the lifecycle lock. Archive owns its coordinated account disablement; it does not require the caller to additionally have `account.disable` or `employee.offboard`.

## Sensitive correction

The JSON patch accepts only these database column keys:

| Group | Allowed keys |
| --- | --- |
| Identity | `national_id_number`, `national_id_issued_date`, `national_id_issued_place`, `national_id_expiry_date` |
| Bank | `bank_name`, `bank_account_number`, `bank_account_holder`, `bank_branch` |
| Other identifiers | `personal_tax_code`, `social_insurance_code` |

Omitted keys preserve their existing values. Explicit JSON `null` clears a value. Non-null values must be strings, are trimmed, and must contain 1–200 characters. A non-null national identity number must contain 9–12 digits. Date strings must be real calendar dates in `YYYY-MM-DD` format. The merged stored expiry date cannot precede the merged issued date, even when the request changes only one date. The existing unique national ID index still rejects duplicates.

An empty patch, unknown key, number/boolean/array/object value, blank string, invalid reason, invalid date, and client-controlled metadata/file link are rejected. The command preserves identity file links and other fields omitted from the patch. A first correction creates the sensitive profile row if it does not already exist. Authorized corrections of an archived historical employee remain permitted; a correction never reenables an account.

History and audit contain the employee row versions and sorted changed field names only. They do not copy ID, bank, tax or insurance values into JSON. History uses `after_data.fields`; audit uses `after_data.changedFields`, with action `employee.sensitive_updated`. The free-form reason remains part of these records; users should enter the reason for the change rather than paste identifiers into it. Retention/access/backup policy must still protect the actual sensitive table and reasons.

## Standalone archival

Archive sets `profile_status` to `archived` and preserves the employee's employment status, employment dates and termination metadata. Contractual offboarding uses the existing profile/offboarding command. It disables every linked application account and revokes its unrevoked `app_sessions` in the same transaction through the owner-only status helper.

The final active administrator rule applies to the coordinated account disablement. If archiving would remove the last active administrator, the profile status, employee version, account status, sessions, history and audit all remain unchanged. Account enablement/provisioning continues to reject an archived employee through the lifecycle command policy.

An already archived employee is rejected rather than producing duplicate archive history. Its original command version also becomes stale, so a lost-response retry cannot repeat an archive event. Existing legacy archive/account inconsistencies require an explicit repair workflow; this command does not silently claim that an already archived record has been repaired.

Archive history and audit contain before/after `{ rowVersion, profileStatus }`; the audit action is `employee.archived`. Account status audit is written by the coordinated helper. Only application sessions are revoked; the Supabase Auth identity is retained, and request authentication checks the current application account status.

## Locking, execution and failures

Both commands acquire the transaction advisory lock for `dtech:account-lifecycle-command`, then the employee row. Sensitive correction locks the sensitive profile row next; archive visits linked accounts in UUID order. This matches the profile/account lifecycle protocol and its reviewed `READ COMMITTED` isolation. External direct table writers do not inherit these protections and must use the same contract before joining the protocol.

The functions are `SECURITY DEFINER`, use an empty `search_path`, schema-qualified application objects, and service-role-only execution. Anonymous/authenticated callers cannot invoke them directly. The account status helper remains owner-only, including denial of direct service-role execution.

| Database result | HTTP behavior |
| --- | --- |
| `EMPLOYEE_NOT_FOUND` | 404 |
| `EMPLOYEE_ACTOR_FORBIDDEN` | 403 |
| `EMPLOYEE_INVALID_PATCH`, `EMPLOYEE_INVALID_DATES` | 400 |
| `EMPLOYEE_VERSION_CONFLICT`, `EMPLOYEE_ALREADY_ARCHIVED`, `LAST_ACTIVE_ADMIN` | 409 |
| Unique national ID violation | 409 |
| Missing migration, transport failure or unknown commit outcome | 503 |

There is no request receipt for these commands. CAS rejects a repeated committed request using its original expected version without adding history/audit. A 503 does not prove rollback: reload and reconcile the profile/history before deciding on another edit. Never automatically replace the expected version or fall back to direct writes. Self-archival can revoke the actor's access and requires another authorized administrator for later reconciliation.

## Verification and remaining boundaries

Native integration checks should cover permission and execution grants, null clearing/omission, merged date validation, duplicate IDs, history/audit value redaction, shared CAS races with profile updates, archival session revocation, final-admin races, and injected failure rollback after each write stage. Retain migration, fixture and suite hashes with the actual test results. A successful local run does not replace a full Supabase rehearsal, customer isolation/UAT or backup restoration.

Identity document upload/remove still combines object storage and table operations separately. Other sensitive data writers, emergency contacts, contracts, rehire and employee creation are separate review scopes. Additive development rollout requires the selected DTech target, a reviewed pending migration set and passing evidence matching the exact migration hash. Production publication remains a separate release decision.
