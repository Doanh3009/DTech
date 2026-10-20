# Architecture index

- Next.js App Router: pages/layouts ở `src/app`; API Route Handlers ở `src/app/api`.
- Authentication: Supabase Auth provider + HttpOnly cookie/session registry ở `src/services/auth`; authorization/RBAC ở `src/services/authorization` và `src/lib/auth`.
- Business modules: `src/features/{employees,attendance,worker-attendance,leave,timesheets,projects,warehouse,import-export,shared-platforms,integrations,dashboard}`.
- System configuration/admin: `src/features/system-admin`, `src/config/systemSettings`, `/system-admin/*`.
- Persistence: server-only Supabase service client; ordered SQL ở `supabase/migrations`; RLS enabled as defense-in-depth, service layer is main boundary.
- Storage: `file_assets` metadata + private buckets; canonical app route generates short signed URL after authorization.
- Report engine: timesheet report registry/generator for Excel, leave PDF generator.
- Operations: structured logs/error IDs, `/api/health/live`, `/api/health/ready`, admin operations page and job/integration aggregates.
- Integrations: API keys, webhook signature/SSRF checks, idempotency/rate limits, sync/import queues.

Browser code không được import server env/service-role client. Schema/business transitions phải nằm trong service/RPC, không chỉ UI.
