# Atomic settings PostgreSQL integration

This suite starts a fresh PostgreSQL 17 cluster on a randomly selected loopback
port, creates only synthetic records, applies the new command migration, and
stops that cluster in `finally`. It reads no Supabase credentials or database URL.
It never attaches to an existing database or service. The temporary cluster and
server logs remain under the ignored `.tmp/erp-settings-db/` directory for review.

## Windows setup

Install the test dependencies into the ignored temporary directory:

```powershell
npm install --prefix .tmp/erp-postgres --ignore-scripts --no-save --package-lock=false --no-audit --no-fund @embedded-postgres/windows-x64@17.10.0-beta.17 pg@8.23.1
node supabase/tests/atomic-settings.integration.mjs
```

The binary is supplied by the primary
[embedded-postgres repository](https://github.com/leinelissen/embedded-postgres).
The driver is supplied by
[node-postgres](https://github.com/brianc/node-postgres).
No application dependency or lockfile is modified. On another operating system,
install `pg` in the same temporary directory and set `ERP_TEST_PG_BIN` to an
existing PostgreSQL 17 `bin` directory. Native PostgreSQL must be run by a normal
user rather than Unix root.

## Coverage and limits

The fixture mirrors only the table contracts used by this command. The suite
checks all eight settings groups, input boundaries, anonymous/authenticated
denial, service role execution and read-only receipt access even under broad
default table grants, active actor and per-group permissions, restore
permissions, version zero initialization, stale version rejection, idempotency,
audit/history consistency and forced failures at every write stage. Audit rows
include the existing nullable/defaulted platform columns and append-only trigger.

Independent connections check simultaneous compare-and-set commands,
simultaneous retries and opposite group ordering while a transaction remains
open. The last case observes the database lock before releasing the first
transaction.

This is command integration evidence. It does not substitute for applying the
entire migration set to a disposable Supabase stack, testing realtime triggers,
or approving a customer deployment. No migration is applied to the existing
DTech cloud project by this runner.

Results, PostgreSQL version and migration/suite/fixture hashes are written to
`docs/commercial-erp/evidence/atomic-settings-integration.json` only after all
checks pass and the disposable cluster has stopped.
