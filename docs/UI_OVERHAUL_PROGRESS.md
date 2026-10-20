# MASTER 03 — Tiến độ đại tu Operational Workbench

Cập nhật: 2026-09-15 (Asia/Ho_Chi_Minh)

## Baseline

| Hạng mục | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Git | completed | Worktree sạch trước khi bắt đầu MASTER 03 |
| Typecheck | completed | `npm run typecheck` đạt |
| Lint | completed | `npm run lint` đạt |
| Test | completed | 38 file, 146 test đạt |
| Production build | completed | Next.js 16.3.4 build đạt, 225 route; log fallback `system_settings.read_failed` đã có từ MASTER 02 |
| Tài liệu nền | completed | Đã đọc progress, kiến trúc, permission, Realtime và deployment checklist |

## Theo dõi stage

| Stage | Trạng thái | Route / thành phần | Viewport / workflow đã kiểm tra | Khiếm khuyết còn lại | Hành động kế tiếp |
| --- | --- | --- | --- | --- | --- |
| 0 — Baseline và audit | completed | Toàn bộ App Router; audit chi tiết tại `UI_AUDIT_BEFORE.md` | Static audit + validation baseline | Không có phiên staging authenticated | Dùng audit làm inventory chuẩn |
| 1 — Workbench foundation | completed | App Rail, Context Panel, header, Command Bar, Work Canvas, Inspector, typography/status | Source, typecheck, lint, test, build | Chưa visual QA shell authenticated | Xác minh bằng UAT staging |
| 2 — Golden Screens | implementation completed; visual blocked | `/dashboard`, `/warehouse/receipts/[id]`, `/attendance` | Static source, unit/regression; login responsive 320–1920 | Thiếu tài khoản/dataset để chụp Golden A/B/C trên route thật | Chụp đủ ma trận khi có staging credentials |
| 3 — Module propagation | completed for representative workflows | HR roster, approvals, settings/admin, warehouse, XNK labels; shared flat-surface CSS áp toàn hệ thống | Static route/label audit + regression | Chưa duyệt tay từng route bằng account theo role | UAT mẫu theo permission matrix |
| 4 — Responsive và state pass | partially completed | Login; CSS shell, dashboard, warehouse editor, attendance, employee/approval workbench | 320, 360, 390, 430, 768, 1024, 1366, 1440, 1920, 2560px trên login; protected redirect | Golden authenticated chưa thể xác minh thật | Chạy lại `npm run ui:qa` và ma trận Golden trên staging |
| 5 — Realtime và regression | static completed; staging blocked | Coordinator + domain reconciliation giữ nguyên; dashboard, attendance, approval tiếp tục refetch API | 146 test + static subscription audit | Thiếu hai tài khoản staging để chứng minh RLS/delivery/reconnect | UAT hai phiên theo `REALTIME_MATRIX.md` |
| 6 — Final QA | completed within local boundary | Toàn repo | typecheck, lint, test, build, diff check, Playwright smoke | Các mục staging nêu trên không được tuyên bố đạt | Bàn giao code + checklist UAT |

## Kết quả chính

- Shell đã tách App Rail và Context Panel; không còn app switcher và create-new chung trong header.
- Dashboard chuyển từ card grid sang operational briefing, loại item lặp và priority code tiếng Anh.
- Kho, chấm công, employee roster và approval áp dụng các archetype workbench tương ứng.
- IBM Plex Sans/Mono được self-host; PDF nghỉ phép nhúng font Việt đầy đủ.
- Cấu hình dùng subnav ngang; route label và microcopy chính đã Việt hóa.
- `scripts/ui-qa.mjs` cung cấp kiểm tra responsive có thể lặp lại bằng Edge/Playwright.

## Ranh giới an toàn

- Không đổi schema, migration, RLS, Storage, auth/session, API contract, repository hoặc state machine nghiệp vụ.
- Realtime tiếp tục dùng coordinator + domain reconciliation; UI chỉ refetch dữ liệu có thẩm quyền.
- Không tạo/reset account Supabase, không ghi dữ liệu production để phục vụ ảnh minh họa.
- Không tuyên bố visual QA authenticated, RLS đa tài khoản hoặc reconnect hai phiên đã đạt khi chưa có bằng chứng staging.
