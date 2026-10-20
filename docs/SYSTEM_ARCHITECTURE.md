# System Architecture

## Quyết định tổng thể

Hệ thống là modular monolith trên Next.js App Router. Một nhóm phát triển nhỏ có thể triển khai trong một tháng mà vẫn giữ ranh giới module rõ ràng. Không tách microservice cho đến khi có bằng chứng về tải, ownership hoặc chu kỳ triển khai độc lập.

```text
Browser
  → Next.js pages/layouts
  → /api/v1 route handlers
  → feature services + validation + authorization
  → Supabase Postgres / Auth / Storage / Realtime
```

Database là source of truth. UI không quyết định transition cuối, tồn kho, số công hay quyền truy cập.

## Quy ước module

```text
src/features/<module>/
  components/       UI thuộc module
  pages/            page composition lớn nếu cần
  schemas/          Zod input/output boundary
  services/         query, command, repository và domain rules
  client/           browser-only queue/sync/cache
  types/            domain/read-model types
  *.test.ts(x)      test gần code sở hữu
```

Route/page ở `src/app`; API ở `src/app/api`; primitive dùng chung ở `src/components/shared`; shell ở `src/components/layout`; cross-cutting utility ở `src/lib`; metadata typed ở `src/config`.

## Ranh giới sở hữu

| Boundary | Trách nhiệm | Code hiện tại / đích |
|---|---|---|
| auth | login, session, refresh/revoke, cookie | `services/auth`, `/api/v1/auth` |
| users | account lifecycle và profile link | `features/employees`, settings users |
| roles-permissions | catalog, role template, enforcement | `lib/auth`, `services/authorization` |
| hr | employee, department, position, contract | `features/employees` |
| attendance | event, location, photo, offline queue | `features/attendance` |
| leave | request, balance, approval snapshot | `features/leave` |
| projects | project/site, assignment, update, issue | `features/projects`, `worker-attendance` |
| warehouse | item, document, posting, ledger, balance | `features/warehouse` |
| import-export | partner, contract, shipment, customs | `features/import-export` |
| executive | dashboard read models và attention | `features/dashboard` |
| notifications | inbox, preference, delivery state | `features/shared-platforms` |
| files | metadata, validation, signed access | `services/storage`, file API |
| reports | template, Excel/PDF generation | `features/reports`, timesheets generator |
| audit | immutable audit event và query | `services/audit`, shared platforms |
| admin | product area quản trị | `features/system-admin` |
| settings | validated/versioned configuration | `config/systemSettings`, services settings |

## Navigation architecture

`config/moduleRegistry.ts` định nghĩa application ID, route prefixes, default route, icon key, permission, feature flag và navigation group. `config/navigation.ts` giữ item-level route metadata. Launcher và contextual sidebar cùng suy ra từ hai registry này, không tự hard-code permission bypass.

Luồng chuẩn: login → `/workspace` → module dashboard → sidebar chỉ của module. App switcher luôn đưa về workspace. Mobile dùng launcher responsive và bottom navigation; sidebar desktop trở thành sheet khi cần.

## Server/client boundary

- Service-role client chỉ tồn tại trong server utility.
- Client component gọi Route Handler; không import repository server.
- Page layout kiểm tra area permission sớm; handler/service tiếp tục kiểm tra resource/action/scope.
- Mutation quan trọng dùng schema, row version hoặc idempotency key và audit event.
- Realtime chỉ báo thay đổi; handler/refetch lấy lại persistent state có thẩm quyền.
