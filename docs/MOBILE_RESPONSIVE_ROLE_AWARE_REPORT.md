# Báo cáo Mobile Responsive & Role-aware

Ngày kiểm tra: 23/09/2026

## Kết quả

Hệ thống dùng một shell responsive chung theo permission. Mobile không còn global bottom navigation; thay vào đó là header gọn, drawer **Ứng dụng của tôi** và context tabs của đúng phân hệ. Desktop rail và nghiệp vụ hiện hữu được giữ nguyên.

UI/UX Pro Max và UI Styling đã được dùng để đối chiếu hierarchy, touch target, density, responsive composition, state và accessibility. Design direction được giữ theo `design-system/chau-tuan-erp/MASTER.md`: enterprise, không gradient trang trí, không card màu ngẫu nhiên, ưu tiên dữ liệu và tác vụ.

## Ma trận bảo toàn

| Hạng mục | Trước thay đổi | Quyết định | Kết quả |
|---|---|---|---|
| Auth và permission backend | Đã có RBAC/service guard | Giữ nguyên | Không đổi API/security contract |
| Desktop navigation | Rail theo permission | Giữ nguyên | Không copy rail dài xuống mobile |
| Mobile global bottom nav | Dùng chung cho mọi ngữ cảnh | Thay UI | Đã loại bỏ |
| Application launcher | Có registry và permission sets | Tái sử dụng | Drawer **Ứng dụng của tôi** chỉ hiện app được phép |
| Project package workspace | Route thật và 4 khu vực nghiệp vụ | Giữ nghiệp vụ, đổi composition | Thi công / Chấm công / Hồ sơ / Tài liệu; tab theo quyền |
| Dashboard | Widget registry dùng permission nhưng trang ép global scope | Sửa context | Dashboard tự chọn profile theo permission |
| Cấu hình dashboard đã lưu | Có preset cũ chưa có profile kế toán | Migration mềm | Giữ tùy chỉnh hợp lệ, tự thêm profile/widget mới |
| Loading/empty/error/403 | Một số màn dùng spinner hoặc empty thay cho 403 | Chuẩn hóa shared state | Skeleton, retry, empty và permission denied tách biệt |
| Fetch project detail | Tiến độ/lịch tải ở nhiều tab | Tối ưu theo active route | Chỉ tải dữ liệu nặng khi tab cần dùng |
| Chat floating launcher | Có thể cạnh tranh vùng CTA mobile | Đổi mobile composition | Mobile dùng entry trong header, không che CTA |

Không thay đổi entity, database schema, workflow, stock ledger, timesheet, attendance, audit, upload hay realtime semantics trong phạm vi này.

## Thành phần và pattern chuẩn

- `MobileAppLauncher`: permission-aware application drawer.
- `MobileContextNav`: context tabs ngang, active state theo pathname.
- `AppHeader`: root header và detail header riêng trên mobile.
- `FilterBar`: desktop inline; mobile search + nút Bộ lọc mở bottom sheet.
- `LoadingState`, `EmptyState`, `ErrorState`, `PermissionDeniedState`: state có semantics riêng.
- `RetryButton`: retry mặc định hoạt động.
- Package workspace: route thật, tab thật, dữ liệu chỉ tải cho section đang active.

Token responsive dùng chung nằm trong `src/styles/tokens.css`; luật shell/mobile nằm trong `src/app/globals.css`; contract đã cập nhật tại `design-system/chau-tuan-erp/MASTER.md`.

## Dashboard theo permission

Thứ tự nhận diện nghiệp vụ cố định là quản lý → giám sát → XNK → kho → kế toán → HR → nhân viên. `presetOrder` chỉ còn là cấu hình preset hợp lệ, không thể khiến tài khoản có quyền giao nhau bị phân loại sai. Profile kế toán có widget tổng hợp bảng lương và quick action theo đúng permission.

## QA responsive

Ma trận E2E đã chạy ở 5 viewport:

- 360×800
- 375×812
- 390×844
- 412×915
- 430×932

Tài khoản seed được kiểm tra:

| Seed | Phạm vi E2E | Kết quả |
|---|---|---|
| `test.supervisor` | Dashboard giám sát, launcher permission, project progress/context tabs | 5/5 đạt |
| `test.employee` | Dashboard nhân viên, launcher permission, chấm công cá nhân | 5/5 đạt |
| `test.payroll` | Shell, launcher permission, bảng lương và empty state | 5/5 đạt |

Mỗi lượt kiểm tra: không tràn ngang, không global bottom nav, không spinner toàn trang, launcher tối thiểu 44×44, app ngoài quyền không xuất hiện, context tab tối thiểu 44px.

Ảnh bằng chứng:

- `docs/ui-evidence/mobile-role-supervisor-390x844.png`
- `docs/ui-evidence/mobile-role-employee-390x844.png`
- `docs/ui-evidence/mobile-role-accounting-390x844.png`

Package workspace đạt ở 1366×768 và 390×844.

## Giới hạn dữ liệu QA

Repo hiện chỉ có ba credential seed dùng được cho lượt visual này. `test.payroll` là role tối thiểu (`payroll.view`, `payroll.edit`, `chat.access`), không có `dashboard.view`; vì vậy dashboard kế toán được kiểm tra bằng unit/registry contract, còn visual E2E của tài khoản này kiểm tra landing page bảng lương. Chưa tuyên bố visual pass cho HR, kho, XNK và admin khi chưa có credential seed tương ứng.

## Lệnh xác minh

- `npm test -- --run`: 62 file, 217 test đạt.
- `npm run typecheck`: đạt.
- `npm run lint`: đạt sau khi xử lý warning mới.
- `node scripts/mobile-responsive-role-qa.mjs`: 15 tổ hợp đạt (dashboard kế toán theo giới hạn seed nêu trên).
- `node scripts/package-workspace-qa.mjs`: desktop và mobile đạt.
- `node scripts/authenticated-smoke.mjs`: kiểm tra route/API/403, desktop/mobile và vùng chat launcher.
- `npm run build`: đạt; Next.js 16.3.4 build đủ 269 route/page.

## Không có thay đổi hạ tầng

Không có migration database, storage policy, auth policy hoặc dependency mới. Thay đổi duy nhất liên quan dữ liệu lưu là normalizer tương thích ngược cho JSON cấu hình dashboard cũ.
