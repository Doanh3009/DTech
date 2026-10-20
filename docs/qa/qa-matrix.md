# QA matrix — release 0.1.0

Trạng thái dùng: PASS (có evidence), FAIL, BLOCKED, NOT RUN. Developer test không thay UAT.

| Luồng | Unit/API automation | Desktop | Mobile | Offline/thiết bị | UAT |
|---|---|---|---|---|---|
| Login/logout/disabled/rate-limit | PARTIAL | NOT RUN | NOT RUN | N/A | NOT RUN |
| Employee + sensitive fields | EXISTING/PARTIAL | NOT RUN | NOT RUN | N/A | NOT RUN |
| Attendance + idempotency/GPS/photo | EXISTING | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Worker attendance 5 bước | EXISTING | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Leave → approval → ledger → PDF | EXISTING | NOT RUN | NOT RUN | N/A | NOT RUN |
| Timesheet lock/unlock/export | EXISTING | NOT RUN | NOT RUN | N/A | NOT RUN |
| Project update/issues | EXISTING | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Warehouse post/reverse/ledger | EXISTING | NOT RUN | NOT RUN | N/A | NOT RUN |
| XNK partial receipt → warehouse | EXISTING | NOT RUN | NOT RUN | N/A | NOT RUN |
| Approval/notification/document/audit | EXISTING | NOT RUN | NOT RUN | N/A | NOT RUN |
| API/webhook SSRF/signature/idempotency | EXISTING | N/A | N/A | N/A | NOT RUN |
| Backup/restore | NONE | N/A | N/A | N/A | BLOCKED |

## Negative permission set

Với mỗi role Employee, Supervisor, HR, Warehouse, XNK, Manager, Admin: test UI không hiện action và API trả 403 cho employee khác, sensitive fields, attendance photo, warehouse ngoài scope, shipment ngoài scope, role/API key/settings/audit. Test UUID không tồn tại phải trả 404/403 nhất quán và không tiết lộ bản ghi.

## Manual device matrix

Chrome/Edge desktop; Android Chrome; iPhone Safari nếu được dùng; camera permission allow/deny; GPS inside/outside/low accuracy; weak network/offline recovery; keyboard/focus; Vietnamese font; PDF print; Excel mở bằng ứng dụng thực. Chưa có kết quả nên tất cả giữ NOT RUN.
