# Supabase Employee/RBAC Setup

## Current Status

- Employee/RBAC migration is ready at `supabase/migrations/202609090002_employee_rbac_foundation.sql`.
- The app reads Supabase data when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- Without Supabase env values, the app uses local demo data for UI development.

## Required Local Env

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_TIMEZONE=Asia/Ho_Chi_Minh
APP_BASE_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-side only.

## Apply Migration

This machine currently does not have the Supabase CLI available.

After Supabase CLI is installed and authenticated:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

## Notes

- Employee records are separate from app accounts.
- Sensitive profile data is in `employee_sensitive_profiles`.
- Employee documents reference `file_assets`; private storage access goes through `/api/v1/files/:assetId/signed-url`, checks RBAC, and returns a five-minute signed URL.
- The current code has a Supabase read adapter. Mutating API routes still use the local repository fallback until write-through is connected and tested against the target project.

## Implemented Employee/RBAC Flows

- Employee create, detail, edit, archive, offboarding, history, contracts, documents, and account tabs.
- Sensitive profile editing is isolated behind `employee.view_sensitive` and `employee.edit_sensitive`.
- Account provisioning, activation status changes, and multiple-role assignment are permission protected.
- Role create/edit supports grouped permission selection and protects the final administrator account.
- Employee, account, role, and sensitive-file actions emit audit records; sensitive values are redacted before persistence.

## API Additions

- `POST /api/v1/employees/:id/archive`
- `PATCH /api/v1/employees/:id/sensitive`
- `PATCH /api/v1/accounts/:id/roles`
- `GET /api/v1/audit-logs`
- `GET /api/v1/files/:assetId/signed-url`

Every mutating endpoint authenticates the request, checks its specific permission, validates input, and records an audit event.

## Verification

- ESLint and TypeScript checks pass.
- The production build passes with the webpack builder. This workstation blocks the native SWC binary, so the build uses Next.js's WASM compiler.
- Production smoke checks cover employee create/read/edit routes, account provisioning, multiple-role updates, account disabling, and employee archiving.
- Focused domain and audit assertions cover duplicate identifiers, manager cycles, sensitive DTO filtering, administrator lockout, effective permissions, and audit redaction.

## Remaining Integration Work

- Connect mutating repositories to the target Supabase project; current mutations are process-local and are not durable across deployments.
- Replace the demo request user with the real authenticated session and mapped account permissions.
- Apply the migrations to the target project and verify RLS/storage policies there.
- Run the Vitest suite in an environment that permits the native Rolldown binary. Windows Application Control blocks that binary on this workstation before test collection starts.
