# Account lifecycle and recovery

## Scope and release evidence

Migration: `supabase/migrations/202610220002_account_lifecycle_recovery.sql`. Application orchestration: `src/features/employees/services/accountLifecycleService.ts`.

The migration has been applied to the selected DTech development project together with `202610220003`; see [rollout evidence](evidence/lifecycle-rollout.json) for hashes, target, dry-run and metadata checks. This is not a production release. The native suite has 165 checks with a minimal Auth stub. No real Auth provisioning or account deletion on the cloud project forms part of this slice's acceptance. The recorded read-only `getUserById` probe confirms a missing UUID response shape only; it does not prove create/delete behavior. Check [progress](progress.md) and final QA evidence for the overall release status.

Auth HTTP calls and application database commands cannot share one PostgreSQL transaction. A durable operation therefore records the intended action before contacting Auth, then records completion after reconciling the external result. An uncertain response leaves a recoverable operation rather than triggering automatic compensation.

## Provisioning

| Step | Durable result |
| --- | --- |
| `prepare_account_provision` | Reserve employee, username, email, application account UUID and Auth UUID; persist immutable request binding and `prepared` receipt. |
| Read/create reserved Auth UUID | Read only that UUID. If absent, create it with the reserved ID and `app_metadata.dtech_operation_id`. Re-read after success, error or a lost response. |
| Validate external identity | UUID, login email and operation metadata must match; deleted/banned identities are rejected by the service. |
| `complete_account_provision` | Recheck actor, current employee eligibility, roles and Auth binding; insert account, role assignments, employee history and audit, then mark `completed` in one transaction. |

A creation timeout may mean that Auth committed. The service never automatically deletes that identity because provisioning completion failed or its response was lost. It reconciles the reserved UUID on retry. It also never searches for an unrelated email match and adopts or deletes that identity. An occupied email with an absent reserved UUID requires an explicit cancellation before a new request.

The installed `@supabase/auth-js` version is `2.116.0`. Its `AdminUserAttributes` declaration includes optional `id` in `node_modules/@supabase/auth-js/src/lib/types.ts`; the service passes this field to `auth.admin.createUser`. This verifies the installed SDK contract, not a real GoTrue create/delete rehearsal.

The same request ID, originating actor and canonical request data return the recorded operation. A different kind, actor or payload conflicts. Roles are deduplicated/sorted and login identifiers normalized before SQL hashing. The first event date is retained in the operation. Current permissions are rechecked on retries and recovery; an old receipt does not grant authority after permission revocation.

## Explicit cancellation

Only a provision operation can be cancelled. The database first changes `prepared` to `cleanup_required` and records the cancellation request. The service then checks the reserved Auth identity's operation ownership before deleting it. `complete_account_provision_cleanup` requires both the Auth identity and any application link to be absent before marking `cancelled` and releasing the employee/login reservations.

A lost Auth DELETE response leaves cleanup resumable. A delayed Auth CREATE carrying the cancelled request metadata is rejected by the reserved-identity INSERT trigger. Completed provisioning cannot be cancelled by this path. A provision already in cleanup follows cleanup completion, including when the UI action is labelled “Hoàn tất thu hồi”. No original password is needed to cancel or finish cleanup.

## Deletion

Deletion has a separate `account.delete` permission. The migration grants it initially only to the `admin` role; another role requires an explicit later permission assignment. `account.disable` alone does not authorize deletion.

`prepare_account_deletion` rejects self-deletion, a deleted tombstone and removal of the last active administrator. Under the lifecycle lock it revokes application sessions, removes role assignments, detaches the Auth/employee links, clears live login identifiers and disables the retained account row. It records employee history, audit and a `cleanup_required` operation in that same transaction. The username becomes a valid deterministic tombstone; historical account references remain intact.

Only after this transaction commits does the service delete the original Auth UUID. `complete_account_deletion` confirms that the Auth row is absent before marking `completed` and recording final audit. The operation retains the original employee/account association for reconciliation. A deletion cannot be cancelled after its access-revocation transaction. Cleanup failure leaves access revoked and the operation visible for another attempt.

Supabase documents that deleting an Auth user can fail while it owns Storage objects, and that already-issued JWTs can remain valid until expiry. DTech checks current application account/session state in addition to the Auth token. Storage ownership failures still need an explicit ownership/data policy before cleanup can complete. See [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data).

Tombstones cannot be activated by the account status helper or receive new role assignments. Normal account lists exclude them. Records required by history and audit are retained rather than physically deleting the application account.

## Credentials, request binding and key rotation

Two hashes serve different purposes:

- The application computes a request-specific credential fingerprint using HMAC-SHA256, `SESSION_HASH_PEPPER` and the initial password. The database stores this fingerprint, not plaintext credentials.
- SQL stores a SHA-256 hash of the kind, creator and canonical request payload, including the credential fingerprint. A request ID cannot be reused to change the reserved identity, roles or credential choice.

`SESSION_HASH_PEPPER` must contain at least 32 characters. Generated initial passwords are derived from this secret and the request UUID with a separate HMAC domain. All instances sharing this customer database must use the same current secret. Each customer deployment/database has its own configuration and secret.

For generated credentials, the service may return the original initial password to the operation creator for at most 15 minutes from preparation. A retry does not extend that window. Another authorized administrator may finish the operation but receives no generated password. Reconciliation never resets an existing Auth password, so the recovery display is the original initial credential, not a claim about the user's current password after a change.

A supplied initial password is never stored by this application. Resuming a prepared custom-password provision requires it again and compares its HMAC fingerprint in constant time. The provision form keeps its immutable retry body only in mounted component memory, including the original password when supplied. The recovery modal keeps the entered password only in memory. No request credentials are written to browser local/session storage or persisted drafts. Generated credentials are cleared on modal close; pending bodies are released on successful completion or matching terminal recovery, and all component memory disappears on unmount.

Rotating `SESSION_HASH_PEPPER` changes both derivation and fingerprints. Inventory pending operations before rotation. A prepared request that can no longer pass its credential binding must be explicitly cancelled/cleaned up and recreated with a new UUID under the new key; do not overwrite its fingerprint or reset an existing Auth password. Cleanup does not depend on re-deriving the password. A completed account needs an independently authorized password-reset workflow if its initial credential is no longer available; this operation does not implement that reset.

## Permissions and module policy

| Operation | Current permission |
| --- | --- |
| Prepare/complete/resume/cancel basic employee login | `account.create` |
| Any provisioning request containing a role whose code is not `employee` | `account.create` and `account.assign_role` |
| Prepare/complete/resume deletion | `account.delete` |
| Pending list/read | Permission for the operation kind, plus role-assignment authority for elevated provision requests |

Actors must be active and must not be tombstoned. The database enforces these rules during preparation, completion, cancellation and recovery reads. Pending lists hide operations outside the actor's current authority. An administrator with the necessary current permissions can recover another actor's operation; credential display remains creator-limited.

New provisioning and resuming a prepared provision require the Human Resources module to be enabled. Cleanup, cancellation, deletion and pending-operation inspection remain available through their permission checks when that module is disabled. Disabling a module must not strand an Auth cleanup task.

## HTTP and UI contract

All routes authenticate before parsing mutation data, validate UUIDs/JSON, and return `Cache-Control: no-store`.

| Route | Request | Success data |
| --- | --- | --- |
| `POST /api/v1/employees/{employeeId}/accounts` | `{ requestId, username, roleIds, password?, loginEmail?, loginPhone? }` | Completed provision receipt; HTTP 201. |
| `DELETE /api/v1/accounts/{accountId}` | `{ requestId }` | Completed deletion receipt. |
| `GET /api/v1/account-operations` | None | `{ operations: [...] }`, pending states only. |
| `POST /api/v1/account-operations/{requestId}` | `{ action: "resume" \| "cancel", password? }` | Completed/cancelled receipt, optionally an eligible generated password. |

Public operation receipts contain `{ requestId, accountId, employeeId, kind, state }` plus eligible `temporaryPassword`. They omit internal Auth IDs, credential fingerprints and full reservation payloads. Pending list entries contain request/account/employee IDs, kind, pending state, username, credential mode and creation time. They omit login email and credential material.

The application uses the receipt directly; there is no separate post-commit account read or audit write that could turn a successful command into an apparent failure. Independent status and role endpoints return `{ accountId, status }` and `{ accountId, roleIds }`; UI merges those fields locally and refreshes authoritative page data.

Provision/delete buttons allocate one UUID and keep the exact body for retries after a timeout, network error, 409 or 503. They do not generate a replacement ID or permit editing a pending credential payload. A definitive validation failure before reservation can return 400 and restore editing. Provision validation failures after durable preparation become 409 so the original pending body remains intact. UI validates receipt identity/state before claiming success.

The “Yêu cầu tài khoản” panel under `/settings/users` supports “Tiếp tục”, explicit “Hủy yêu cầu” for prepared provisioning, and “Hoàn tất thu hồi” for cleanup. It also appears inline in the employee Account tab, filtered to that employee and hidden when empty. Existing employee/tab access rules still apply, but an actor with `account.create` or `account.delete` does not additionally need `user.view` to recover that employee's operations there. The settings user page itself still requires `user.view`. A prepared custom-password resume asks for the original password. Deletion cleanup completes with state `completed`; provisioning cleanup finishes with `cancelled`. Clipboard failures retain the visible credential and do not display a false success state.

## Locks, triggers and execution boundaries

Commands share the transaction advisory lock `hashtextextended('dtech:account-lifecycle-command', 0)` on the same PostgreSQL instance. It precedes operation, employee and application account row locks; coordinated employee/account operations use the same protocol. The reviewed isolation is `READ COMMITTED`. Direct writers or another isolation level require their own review.

Three guarded paths extend that protocol:

1. `dtech_reserved_auth_identity`, before INSERT on `auth.users`, inspects `raw_app_meta_data.dtech_operation_id`. Inserts without that marker return immediately. Marked inserts require the matching reserved UUID/email and a currently prepared provision after acquiring the lifecycle lock. This closes delayed creation after cancellation.
2. `dtech_linked_auth_deletion`, before DELETE on `auth.users`, acquires the lifecycle lock and rejects any Auth row still linked by `app_accounts`. This deliberately affects direct Dashboard/admin deletion of linked users: prepare application deletion first. Auth may already hold its row lock at this trigger; provisioning completion reads Auth without taking that row lock. Current `app_accounts.auth_user_id` has no Auth foreign key. Adding such a foreign key or other Auth row-locking writers changes the concurrency proof and needs review.
3. `app_sessions_require_active_account`, before INSERT on `app_sessions`, acquires the lifecycle lock and requires an active, untombstoned account. An insert committed before disablement is revoked by that command; an insert queued after disablement is rejected. Reactivation does not restore the revoked/rejected session.

The trigger helpers and other private helpers are owner-only, including denial of direct service-role execution. Public command RPCs are service-role-only and independently authorize the actor. The operations table has RLS enabled; anonymous/authenticated roles have no access and the service role has SELECT only. Mutation occurs through the checked commands.

These are scoped custom Auth integrations, not a claim that triggers are harmless for every Supabase workflow. Supabase cautions that failing Auth triggers can block signup and that managed Auth schema objects can change. Test the exact installed GoTrue/schema/trigger combination before production. See [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data).

## Rollout, rollback and verification limits

Pause legacy account writers during rollout. The old `provision_app_account` RPC loses service-role execution to stop bypassing reservation/recovery; deploy its new callers together with the migration. Do not restore split Auth deletion or automatic compensating deletion as an emergency application rollback. Keep access revoked for outstanding deletion cleanup. Use a reviewed forward correction for database changes, reconcile durable operations, and retain the operation/history/audit trail.

The native suite is `supabase/tests/atomic-lifecycle.integration.mjs`; its [README](../../supabase/tests/atomic-lifecycle.README.md) documents dependencies and exact scope. It runs actual relevant application migrations and constraints, but its local `auth.users(id, email, raw_app_meta_data)` and null `auth.uid()` are deliberately minimal stubs. A simulated Auth role exercises SQL permissions/guards. The suite does not run GoTrue HTTP, password hashing, email, Storage, Realtime or the full Supabase stack. Service/unit tests simulate external success, failures and lost responses; browser acceptance intercepts mutation calls rather than creating/deleting real cloud users. Use the final evidence for counts and hashes, not a number copied into this guide.

A complete rehearsal still needs real Auth API behavior, managed schema triggers/roles and the customer's storage ownership policy in an isolated Supabase environment. The official [Supabase Auth contributing guide](https://github.com/supabase/auth/blob/master/CONTRIBUTING.md) describes running GoTrue and its PostgreSQL migrations/tests together; a handwritten Auth table is not equivalent.

## Retention and remaining review

Operation payloads/receipts retain employee/account/Auth UUIDs, username, login email, phone, display name, role assignments, credential mode/fingerprint and actor/time metadata. Tombstone metadata retains original login identifiers for reconciliation. Employee history, audit and auxiliary command reasons also remain retained. None of this is an erasure or anonymization feature. Free-text reasons can contain personal data even when the structured sensitive-history JSON includes only field names.

There is no automatic purge, expiry or data-subject erasure workflow for completed/cancelled operations in this slice. Define retention, access, export, backup and legal-hold policy before production. Purging operation rows without a reviewed replacement binding can undermine late-Auth guards and replay/reconciliation behavior. Do not log credentials, fingerprints, internal Auth IDs or retained payload values in acceptance evidence.
