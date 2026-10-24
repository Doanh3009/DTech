# Account lifecycle and employee auxiliary integration

The runner starts a fresh PostgreSQL 17 cluster on a random loopback port. It
does not read environment credentials or attach to an existing database. All
employees, accounts, identity rows and sessions are synthetic. Its own cluster
is stopped in `finally`; ignored data and logs remain under
`.tmp/erp-lifecycle-db/` for review.

## Run

Reuse the temporary native PostgreSQL dependencies used by the settings and
employee suites:

```powershell
npm install --prefix .tmp/erp-postgres --ignore-scripts --no-save --package-lock=false --no-audit --no-fund @embedded-postgres/windows-x64@17.10.0-beta.17 pg@8.23.1
node supabase/tests/atomic-lifecycle.integration.mjs
```

The application package and lockfile are unchanged. On other operating
systems, install `pg` in that temporary directory and set `ERP_TEST_PG_BIN` to
a PostgreSQL 17 `bin` directory. Windows restricted sandbox tokens can prevent
`initdb`; execution then needs a permitted normal operating system user.

## Database fidelity

The suite executes actual foundation, employee RBAC, username and personal
profile migrations and exact relevant session, audit, date and provisioning
fragments. It then applies the deployed `202610220001` employee command and both
new migrations, `202610220002` and `202610220003`. Employee/account tables are
not replaced with handcrafted substitutes: their real constraints, row version
trigger, account-per-employee index and audit append-only behavior are retained.

The Auth schema contains a deliberately minimal local `auth.users` table
(`id`, `email`, `raw_app_meta_data`) and null `auth.uid()` stub. Tests insert and
remove these synthetic identity rows to check command identity binding and
cleanup prerequisites. A simulated `supabase_auth_admin` role has only Auth
schema/table access; its guarded inserts and deletes prove that trigger
functions need no new direct public table grants. This does **not** exercise GoTrue, external Auth HTTP
calls, password hashing, email, Storage or Realtime. Application orchestration
and uncertain external HTTP outcomes require separate unit and service checks.

## Coverage

- Sensitive profile omission/null handling, merged issue/expiry dates, strict
  field types and limits, the real unique identity number constraint, shared
  employee compare-and-set, and history/audit containing field names and
  versions without sensitive values.
- Archival preserving employment status, account disable and session
  revocation, required reasons, final administrator protection, permissions,
  service-only command access and stale retries.
- Injected failures at sensitive, employee, account, session, history and audit
  stages, proving earlier writes roll back.
- Durable account reservation, identity ownership, immutable request retry,
  authorized recovery, pending deletion tombstones, cleanup and completion.
- Basic account creation does not authorize assigning elevated roles. Current
  role assignment permission is checked when preparing, reading and completing
  an elevated reservation; pending lists hide elevated requests from a basic
  account creator. Revocation between preparation and completion is covered.
- Concurrent commands share the same lifecycle lock. Observer connections
  verify queued operations wait; final administrator deletion, status change,
  role removal, offboarding and archival cannot remove all administrators.
- Session registration rejects inactive or deleted accounts. Explicit queued
  races cover insertion before and after disablement: earlier inserts are
  revoked, later inserts are rejected, and reactivation revives neither.

Evidence is written only after every check passes and the cluster stops:
`docs/commercial-erp/evidence/atomic-lifecycle-integration.json`. It records
PostgreSQL version, the test list, both new migration hashes, actual baseline
source/fragment hashes, fixture/runner/case hashes, `externalAuthExercised:
false`, no cloud access or production writes, and `clusterStopped: true`.

This is an isolated native database rehearsal, not a full Supabase deployment
or customer acceptance run. No cloud employee or administrator is disabled,
archived, created or deleted by this suite.
