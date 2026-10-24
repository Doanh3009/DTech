# Atomic employee PostgreSQL integration

The runner creates a fresh PostgreSQL 17 cluster on a random loopback port. It
uses only synthetic employee/account data and stops its cluster in `finally`.
It does not load `.env` files, Supabase credentials or a database URL, and cannot
attach to an existing cluster. Ignored data and server logs remain under
`.tmp/erp-employee-db/` for review.

## Run on Windows

Reuse the temporary dependencies installed for the settings integration suite:

```powershell
npm install --prefix .tmp/erp-postgres --ignore-scripts --no-save --package-lock=false --no-audit --no-fund @embedded-postgres/windows-x64@17.10.0-beta.17 pg@8.23.1
node supabase/tests/atomic-employee.integration.mjs
```

No application package or lockfile is changed. On another operating system,
install `pg` in the same temporary directory and set `ERP_TEST_PG_BIN` to an
existing PostgreSQL 17 `bin` directory. Native PostgreSQL requires a normal
operating system user; Windows restricted sandbox tokens may prevent `initdb`
from starting. The runner must then run under a normal permitted user.

## Database fidelity

The suite executes the actual foundation, employee RBAC, username and personal
profile migrations. It also executes exact relevant source fragments from the
session/account hardening, shared audit, probation constraint and atomic account
provisioning migrations. Each source file and executed fragment has its SHA-256
recorded in the evidence. There are no handcrafted substitute employee/account
table definitions. The small `auth.uid()` stub returns null; Supabase Auth is not
running in this cluster.

This preserves employee/account foreign keys, enum values, required/defaulted
columns, the employee version trigger, the account-per-employee unique index,
session constraints and audit append-only protection. One explicitly named
defensive test temporarily drops the account uniqueness index inside a rolled
back transaction to prove legacy duplicate accounts cannot escape offboarding.
Another temporarily disables then restores the baseline manager-cycle trigger
while constructing a corrupt legacy chain, so the command's bounded recursive
validation can be exercised against that historical inconsistency.

## Coverage

- Required version compare-and-set, stale retries and concurrent writers.
- Profile field persistence, omitted fields, JSON null clears and phone normalization.
- Date checks against merged stored data and strict offboarding requirements.
- Changed catalog references must be active; unchanged historical inactive
  assignments remain editable. New manager references must be active and
  unarchived, with self, indirect and preexisting cycles rejected. Opposite
  simultaneous manager assignments cannot create a new cycle.
- Active actor permissions, mixed edit/offboard permission checks, public RPC
  access denial and private helper denial even for the service role.
- One employee version increment for offboarding and archival, linked account
  disable, revocation of every live application session, history and audit.
- Injected failures at employee, account, session, history and audit stages,
  including the final employee audit after earlier writes and failure on the
  second defensive legacy account.
- Archived/terminated profile activation and provisioning denial.
- Concurrent final administrator disable, cross role removal/offboarding, and
  both orderings of account disable against offboarding. Explicit transactions
  hold the lock while an observer connection confirms the other writer waits.
- Provisioning versus offboarding in both orders, and provisioning history
  failure rolling back its database account/roles.

Evidence is written only after every check passes and the cluster stops, to
`docs/commercial-erp/evidence/atomic-employee-integration.json`. It includes the
PostgreSQL version, test list, migration/suite/fixture/source hashes and
`clusterStopped: true`.

## Limits

This suite validates database commands on native PostgreSQL. It does not run the
whole migration set or Supabase Auth, Storage or Realtime. It does not validate
external Auth user compensation after an uncertain provisioning response, nor
application-level account deletion paths. Those remain separate work. No
customer or cloud records are created, edited, disabled or deleted by this
runner.
