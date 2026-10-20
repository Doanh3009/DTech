# Security review — 2026-09-14

## Resolved in this hardening pass

- Removed unconditional `foundationDemoUser` from request/layout/login flow (P0 auth bypass).
- Employee demo fixtures remain only as unit-test data; production repository refuses fallback when Supabase is unavailable.
- Supabase Auth provider validates password; server maps auth user to active app account and effective DB roles.
- HttpOnly/Secure/SameSite session cookies, registry/revoke/logout, change-password force logout and throttling.
- State-changing browser requests check Origin; no credentialed wildcard CORS.
- Route/API services use permission checks and scoped object queries; Zod DTOs whitelist mutation fields.
- CSP/frame/nosniff/referrer/permissions policy; user strings are rendered by React, no `dangerouslySetInnerHTML` found.
- Webhook URL rejects non-HTTPS/private/metadata destinations and revalidates DNS; HMAC has timestamp tolerance.
- Core document/project/warehouse/shipment uploads check extension, MIME and magic bytes; image flows already validate signatures/dimensions. Spreadsheet cells neutralize formulas.
- Errors hide provider details, return request ID; logs redact auth/cookie/secret/password/body/payload keys.

## Open risk / required verification

- Run role-by-role automated IDOR negative suite against real seeded staging accounts; current service tests are not complete proof for every route.
- Malware scanning is not implemented; quarantine/scan integration required or accepted risk.
- Verify actual Supabase private bucket policies and built client bundle in deployment; repository inspection alone is insufficient.
- `npm audit` còn 2 moderate từ `exceljs` → `uuid <11.1.1`; fix tự động yêu cầu downgrade breaking về ExcelJS 3.4.0. CI chặn high/critical; cần regression/upgrade plan thay vì `--force` mù quáng.
- Password reset is an operator/provider recovery process; user-facing self-service recovery is not enabled.
- Production secrets/rotation, test account sweep and suspicious-login alert sink require infrastructure evidence.

Threat boundaries: browser is untrusted; service-role only server; external machine APIs use separate keys/signatures; storage URL is temporary capability after server authorization.
