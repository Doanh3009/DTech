# Configuration catalog

| Group | Examples/default source | Effect | Risk |
|---|---|---|---|
| branding | system name/logo/favicon | login/header | public asset only; no PII |
| appearance | primary color/density/sidebar | UI | contrast/accessibility review |
| navigation/dashboard | route/order/landing widgets | visible entry/landing | route still checks permission |
| modules | enabled module flags | feature visibility | disable does not delete data |
| organization | company identity | PDF/header | legal text business review |
| localization | Asia/Ho_Chi_Minh/date/number | business date/display | changing timezone affects scheduled interpretation |
| attendance | geofence/accuracy/photo | check-in validation | physical-site pilot required |
| leave | type/policy/workflow/effective date | request/ledger/approval | no retroactive silent change |
| timesheet | shift/calendar/lock/export template | calculation/export | first payroll reconciliation |
| warehouse | types/scopes/posting | ledger mutation | post/reverse privilege review |
| integrations | URL/direction/conflict/retry | external sync | secret manager + SSRF/signature |

Canonical defaults/schema ở `src/config/systemSettings.ts` và domain migrations. Mọi thay đổi critical cần reason/audit; production không sửa DB trực tiếp.
