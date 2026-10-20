# Foundation Audit — Châu Tuấn Enterprise System

Ngày audit: 14/09/2026. Phạm vi: repository hiện tại trước khi hoàn thiện Master Prompt 01.

## Stack hiện tại

- Next.js 16.3.4 App Router, React 19, TypeScript strict, Node.js từ 20.
- CSS toàn cục và component class tự xây dựng; không dùng Tailwind/shadcn.
- Supabase JS 2.45 cho Auth, PostgreSQL, Storage và nền tảng Realtime.
- Zod cho validation; Vitest + Testing Library; ESLint 9 với cấu hình Next.js.
- ExcelJS, pdf-lib và fontkit cho xuất báo cáo. Triển khai hướng Vercel, không phụ thuộc Docker.

## Kiến trúc đã có

Luồng chính: `src/app` → Route Handler `/api/v1` → service/repository theo feature → Supabase. Phiên đăng nhập dùng Supabase Auth kết hợp cookie HttpOnly và bảng `app_sessions`. Permission được tổng hợp từ role ở server; API mutation kiểm tra permission trong service/handler. Business module nằm ở `src/features`, schema tại feature, cấu hình dùng chung tại `src/config`.

Các module đang có code thật: nhân sự, chấm công, bảng công/ca làm, nghỉ phép/phê duyệt, dự án/công trường, điểm danh công nhân, kho, xuất nhập khẩu, tài liệu/thông báo, báo cáo, tích hợp và quản trị hệ thống.

## Baseline validation

Chạy trước nhóm thay đổi foundation mới:

- `npm run typecheck`: pass; Next route types được tạo thành công.
- `npm run lint`: pass.
- `npm test`: pass, 29 test files và 127 tests.

## Điểm tốt được giữ nguyên

- Một server-only service-role client; browser client chỉ nhận public key.
- `.env.local` bị ignore; `.env.example` chỉ chứa tên biến.
- API error trả thông điệp an toàn và request ID, không trả raw database error.
- Audit service lọc dữ liệu nhạy cảm và ghi xuống database khi có cấu hình.
- Kho dùng document/ledger/RPC và idempotency key; không sửa trực tiếp số dư từ UI.
- Attendance đã có IndexedDB queue, client event ID và retry; worker attendance có draft store riêng.
- File upload có MIME signature, size, dimension và ownership metadata.

## Rủi ro/khuyết điểm phát hiện

1. Nhiều bảng đã bật RLS nhưng chỉ có một policy được khai báo trong migration. Hiện service-role + authorization server là biên chính; browser direct database mặc định bị deny. Cần policy theo scope trước khi mở thêm browser query/Realtime.
2. Browser Supabase client chưa được gắn authenticated JWT do hệ thống chủ ý giữ access token trong cookie HttpOnly. Realtime lifecycle có thể chuẩn hóa ngay, nhưng subscription database sẽ cần chiến lược token an toàn trước khi mở rộng.
3. Notification chỉ polling mỗi 60 giây; chưa có lifecycle/dedup/reconnect Realtime dùng chung.
4. Layout gốc mới xác thực đăng nhập; nhiều page trước đây chỉ bị chặn khi API trả 403. Cần guard server theo khu vực để direct URL có trạng thái forbidden rõ ràng.
5. Sidebar trước đây chứa mọi module, tạo danh sách dài và không phản ánh application context.
6. Metadata launcher, sidebar và route bị phân tán. Cần registry typed làm nguồn điều phối chung.
7. `globals.css` lớn và nhiều feature style nằm chung; chưa nên migrate CSS framework trong phase này, nhưng cần giữ token/primitives làm lớp ổn định.
8. Một số file feature cũ viết dạng một dòng, khó review. Không format hàng loạt để tránh diff lớn ngoài phạm vi.
9. Chưa có service worker/PWA. IndexedDB queue có foreground retry nhưng background sync chưa được bảo đảm trên iOS.
10. Logo validator cũ chỉ nhận logo ngang, không tương thích logo chính thức dọc.

## Refactor thực hiện trong phase này

- Registry ứng dụng typed, launcher theo quyền và contextual sidebar.
- Server area guard dùng permission catalog tập trung.
- Realtime scoped subscription có cleanup, dedup, reconnect invalidation và fallback polling.
- Tách topbar global khỏi breadcrumb/page content, hoàn thiện responsive shell.
- Tích hợp logo chính thức và token thương hiệu Châu Tuấn.
- Tài liệu hóa architecture, data integrity, permission, Realtime, offline và audit/error.

## Chủ động hoãn

- Không tạo hàng loạt RLS policy suy đoán khi chưa chốt scope công ty/dự án/phòng ban cho từng bảng.
- Không chuyển toàn bộ data fetching sang một query library mới.
- Không thêm service worker hoặc background sync giả định hỗ trợ đồng đều.
- Không tạo migration cho module tương lai; không đổi business workflow đang chạy.
- Không đổi tên permission hiện hữu vì key đã được lưu trong database và tài liệu vận hành.
