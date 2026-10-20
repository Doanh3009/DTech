# MASTER 04 — Tiến độ hoàn thiện UI theo route

Cập nhật: 2026-09-15 (Asia/Ho_Chi_Minh)

## Baseline kỹ thuật

| Gate | Kết quả trước sửa |
| --- | --- |
| Git | Worktree chứa toàn bộ thay đổi chưa commit của MASTER 03; được bảo toàn |
| Typecheck | Đạt |
| Lint | Đạt |
| Test | 38 file, 146 test đạt |
| Migration validation | 21 migration đúng thứ tự |
| Build gần nhất | Đạt, 225 route; còn log fallback `system_settings.read_failed` đã biết |
| Route UI | 154 page trong route group `(app)`, cộng login/not-found/error |

## Chẩn đoán ban đầu

| Lỗi | Bằng chứng source | Nguyên nhân |
| --- | --- | --- |
| Lặp tiêu đề | `AppHeader` render `application.label` + `meta.title`; `AppShell` luôn render breadcrumb; route lại render `PageHeader` | Ba lớp cùng sở hữu route title |
| `Tổng quan` lặp | App Rail tooltip/aria, Context Panel identity/nav, topbar và content cùng dùng chuỗi này | Không có quy tắc bỏ context panel một mục và breadcrumb một cấp |
| Nội dung/sticky không ổn định | topbar sticky trong flow nhưng subnav/command bar dùng `top: 58px`; token gốc vẫn `--header-height: 66px` | Hai mô hình geometry và offset hardcode cạnh tranh nhau |
| Nhãn đồng bộ bị ép | topbar dành cột cho title không thuộc trách nhiệm của nó; trạng thái cho phép wrap/`overflow-wrap:anywhere` ở vùng lân cận | Không có action-priority model và no-wrap rõ ràng |
| Font Việt chưa đủ bằng chứng | body khai IBM Plex Sans nhưng fallback list cũ còn Be Vietnam Pro/Noto/Inter; smoke chỉ đọc family string | Nhiều khai báo font và chưa kiểm `document.fonts` với glyph Việt |
| Crash cục bộ | Chỉ có root `src/app/error.tsx` | Chưa có error boundary riêng cho route group authenticated |

## Ma trận route/contract

Mỗi pattern dưới đây đại diện toàn bộ 154 page được lấy trực tiếp từ `src/app/(app)/**/page.tsx`. Role là role có permission tương ứng; dữ liệu và hành động vẫn do API/RLS quyết định.

| Route/pattern | Role | Primary object/task | Archetype | Realtime | Mobile | Baseline |
| --- | --- | --- | --- | --- | --- | --- |
| `/workspace`, `/dashboard*`, `/home` | mọi tài khoản hợp lệ | ứng dụng, ngoại lệ, queue | launcher/briefing | dashboard reconcile | một cột | lặp title từ shell |
| `/employees*` | HR | roster/hồ sơ | list + inspector/detail/form | employees | list responsive | shell lặp title |
| `/attendance*` | nhân viên/HR | chấm vào-ra/lịch sử | field flow/list/detail | attendance + offline queue | critical | shell lặp title |
| `/timesheets*`, `/shifts` | HR/quản lý | kỳ công/ngoại lệ/ca | table/detail/form | timesheets | reduced columns | shell lặp title |
| `/leave*` | nhân viên/quản lý | đơn nghỉ/duyệt/số dư | queue/form/detail | leave | critical create/detail | shell lặp title |
| `/projects*`, `/project-monitoring*` | dự án/quản lý | dự án/cập nhật/vấn đề | list/detail/timeline | projects | update critical | shell lặp title |
| `/worker-attendance*` | công trường | phiên/điểm danh | field workflow/review | worker attendance | critical | shell lặp title |
| `/warehouse*` | kho | master data/chứng từ/tồn/ledger | table/document workbench | warehouse | list/detail/create critical | shell lặp title |
| `/import-export*` | XNK | hợp đồng/lô hàng/chứng từ | desk/detail/timeline | import-export | one column | shell lặp title |
| `/approvals*` | người duyệt | quyết định | queue + inspector/detail | approvals | inspector stacks | shell lặp title |
| `/documents*`, `/notifications*`, `/reports` | vận hành | tài liệu/thông báo/xuất file | list/detail | notifications/doc lifecycle | critical notifications | shell lặp title |
| `/search*`, `/command`, `/profile` | người dùng | tìm kiếm/tài khoản | results/detail | lifecycle | dedicated view | shell lặp title |
| `/settings*`, `/system-admin*` | admin theo quyền | cấu hình/audit/integration | configuration | settings/notices | horizontal subnav | sticky offset hardcode |

## Stage

| Stage | Trạng thái | Kết quả / việc còn lại |
| --- | --- | --- |
| 0 — Baseline | completed | Đã đọc tài liệu, route config, shell/font và chạy gate |
| 1 — Stability triage | partial | Đã sửa Realtime burst/rejection, route-refresh burst, stale search và thêm route error boundary; auth/slow-action thật cần staging session |
| 2 — Font | completed | Roboto Vietnamese 400/500/600/700 là primary UI font; browser glyph/computed-font đạt; PDF giữ font nhúng riêng và regression test đạt |
| 3 — Shell/geometry | completed | Topbar không sở hữu route title; breadcrumb/context một mục tự ẩn; sticky offset dùng token chung |
| 4 — Component completion | completed | Có inventory, consumer map và rule dùng primitive/workbench hiện hữu |
| 5 — Critical routes | partial | Đã sửa/static audit title ownership; browser authenticated theo role bị chặn bởi thiếu session staging |
| 6 — Remaining routes | partial | `ui:audit` kiểm 154/154 page: 101 title trực tiếp, 47 ủy quyền, 6 redirect; chưa mở trực quan từng route authenticated |
| 7 — Responsive/Realtime/stress | blocked in part | Login production đạt 14 viewport + 4 zoom; burst 100 event và 30 lifecycle đạt; two-account/authenticated vẫn cần staging credentials |
| 8 — Acceptance | partial | Typecheck/lint/test/migration/build và anonymous visual đạt; chưa đủ bằng chứng để tuyên bố toàn bộ UI authenticated hoàn tất |

## Bằng chứng visual baseline

- Screenshot login production hiện có tại `docs/ui-evidence` cho 320, 390, 1440, 1920 và 2560px.
- Không có session authenticated trong workspace; vì vậy chưa ghi title count, computed font hoặc collision của shell trên route thật.
- Không tạo/reset tài khoản Supabase hoặc dùng dữ liệu giả trong production để vượt qua blocker.
- Browser sweep sau sửa: 14 viewport (320–2560 px), zoom 80/100/125/150%, computed Roboto và glyph Việt đều đạt trên login production.
- Static contract: `npm run ui:audit` đạt cho 154 route authenticated; đây không thay thế kiểm tra trực quan theo role.
- Báo cáo failure mode, stress test và blocker staging nằm tại `docs/PERFORMANCE_STABILITY_REPORT.md`.

## Corrective redesign — compact enterprise ERP

- Outer shell được giữ nguyên cấu trúc, kích thước, điều hướng, permission visibility và realtime status.
- Workspace dùng nền trung tính; page header, filter, tab, table, form section, workbench, modal/drawer và operational panel có border 1px rõ ràng.
- `OperationalSection` tách header/meta/body để nội dung không còn là các khối phẳng nối tiếp nhau.
- Dashboard dùng command bar theo quick action đã lọc quyền, KPI strip và biểu đồ thanh sinh từ metric thật; không bổ sung dữ liệu giả hoặc đổi API.
- Data table có accessible name và selected-row treatment nhất quán; màn Nhân viên giữ contract cột riêng.

## Gate sau sửa

| Gate | Kết quả |
| --- | --- |
| `npm run typecheck` | Đạt |
| `npm run lint` | Đạt, 0 lỗi |
| `npm test` | 44 file, 156 test đạt |
| `npm run validate:migrations` | Đạt, 21 migration đúng thứ tự |
| `npm run ui:audit` | Đạt, 154 route authenticated |
| `npm run build` | Đạt, 225 route |
| `npm run ui:qa` | Đạt, 14 viewport + 4 mức zoom + 3 protected-route redirect |

Build vẫn ghi log fallback `system_settings.read_failed` khi tạo static page với môi trường hiện tại. Build không thất bại; đây là vấn đề cấu hình/dữ liệu môi trường đã tồn tại và chưa được che hoặc đổi hành vi trong đợt UI này.
