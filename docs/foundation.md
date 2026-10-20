# Prompt 1 Foundation

## Architecture

Luồng chính:

```text
Web / Future Mobile
  -> Next.js App Router
  -> /api/v1 route handlers
  -> Business services
  -> Supabase PostgreSQL + private storage
```

Frontend permission chỉ dùng để điều hướng và hiển thị action. API vẫn gọi `requirePermission` ở server-side.

## Route Rules

- Primary navigation dùng route thật, không dùng `activeSection`.
- Entity detail dùng route-backed tabs:
  - `/employees/:id/profile`
  - `/employees/:id/attendance`
  - `/projects/:id/overview`
  - `/projects/:id/updates`
- Main filters sau này nên phản ánh lên query string khi ảnh hưởng nghiệp vụ.

## Module Contract

Mỗi feature module nên đi theo:

```text
src/features/<module>/
  pages/
  components/
  hooks/
  api/
  schemas/
  types/
  utils/
```

Prompt 1 chỉ tạo boundary và placeholder. Không hard-code policy công ty vào UI.

## Security Baseline

- Không commit secret.
- Supabase service role chỉ import ở server utility.
- RLS bật trong migration.
- File nội bộ đi qua metadata + signed access endpoint.
- Audit log không lưu password/token/secret.
- Error response không lộ raw stack trace.
