# Landing page và tiếp nhận dùng thử

> C?p nh?t 23/10/2026: ti?p nh?n v? thi?t l?p kh?ch h?ng ?? chuy?n sang portal ri?ng c?a team setup t?i `/control-center`; quy?n operator/c? m?i tr??ng, ph?n trang v? form kh?o s?t m?i xem [h??ng d?n CRM tri?n khai](operator-crm-guide.md). `/system-admin/trial-requests` ch? c?n redirect t??ng th?ch. Ph?n d??i ghi l?i slice ti?p nh?n ban ??u ng?y 22/10.
## Hành trình

`/` → `/dang-ky-dung-thu` → xác nhận tiếp nhận → DTech liên hệ/xác định phạm vi → cấp deployment, Supabase và tài khoản riêng → `/login` → `/applications` → nghiệp vụ trong module.

Nút đăng nhập dành cho người đã có tài khoản. Gửi form không tự tạo Auth user, không gửi email tự động hoặc phát sinh giao dịch dịch vụ. Màn xác nhận ghi nhận một yêu cầu, không tuyên bố môi trường đã được cấp. Trạng thái `qualified` là đã xác định phù hợp dùng thử, chưa phải bằng chứng bàn giao tài khoản.

Nội dung công khai ở `src/config/marketing.ts`; product identity độc lập với customer settings. Ví dụ xây dựng là tình huống minh họa theo yêu cầu người dùng. Chưa có tên, ảnh/logo hay kết quả khách hàng được duyệt công khai; cần xác nhận trước khi thêm case study thật. Không quảng bá GL/BOM/sản xuất khi chưa triển khai.

## API, dữ liệu và quyền

- POST `/api/v1/trial-requests`: public; giới hạn body 10KB, strict schema, contact/email/phone bounds, consent=true và honeypot rỗng. RPC `submit_product_trial_request` lưu một bản ghi theo request UUID, HMAC payload và dấu kiểm soát tần suất. Receipt chỉ chứa requestId/received.
- GET cùng endpoint: cần `system_admin.access` và `trial_request.view`; tối đa 100 yêu cầu mới nhất, không trả hashes. Admin UI tìm/lọc trên tập được tải, hiển thị rõ giới hạn 100.
- PATCH `/api/v1/trial-requests/[id]`: cần `system_admin.access` và `trial_request.manage`; actor lấy từ session, CAS row version, reason bắt buộc. RPC review kiểm tra lại active actor/quyền/trạng thái; update và audit trong cùng transaction. Lỗi 409/503 giữ reason và yêu cầu tải lại.
- `/system-admin/trial-requests` có page gate riêng và menu theo quyền. Hai permission mới chỉ grant sẵn cho role admin.
- `product_trial_requests` có RLS. Anon/authenticated không SELECT/EXECUTE. Service chỉ SELECT trực tiếp và execute hai SECURITY DEFINER commands với search_path rỗng; không direct INSERT/UPDATE/DELETE.

`SESSION_HASH_PEPPER` tối thiểu 32 ký tự là điều kiện ghi. Không ghi địa chỉ mạng gốc hoặc nội dung form vào log/evidence. X-Forwarded-For chỉ là tín hiệu best effort, không phải một nguồn danh tính được tin cậy; quota contact/global vẫn áp dụng. Giới hạn trong transaction: 5/network/hour, 2/contact/hour, 100/global/hour; replay cùng request/body được xét trước quota. Không tự tạo UUID mới khi timeout. Xoay pepper giữa các lần thử lại có thể cần người phụ trách đối chiếu.

## Vận hành và riêng tư

Form chỉ giữ body/request trong bộ nhớ trang khi kết quả chưa rõ; không local/session storage chứa contact data. Sau reload, liên hệ qua mã yêu cầu khi đã nhận hoặc thông tin đã gửi. Dữ liệu và review reasons là dữ liệu liên hệ có kiểm soát, chưa có purge tự động. Người vận hành cần quản lý retention, xử lý cập nhật/rút/xóa, chống spam ở ingress và quy trình cấp môi trường trước khi phát hành công khai. Không đưa dữ liệu nhân sự/chứng từ vào trường nhu cầu.

Migration `202610220004_product_trial_requests.sql` đã áp dụng vào DTech development riêng sau native/hash/target/dry-run guards. Không reset/seed hay tạo lead/Auth giả trên cloud. Native suite `npm run test:trial:integration` dùng PostgreSQL tạm với hai migration foundation thực; bằng chứng và hash ở `evidence/trial-requests-integration.json`. Browser `npm run smoke:marketing` chặn các POST/PATCH intake/review tổng hợp trước khi chúng đi tới backend; chỉ dùng đăng nhập/đăng xuất thật cho phiên audit.

## Điều hướng và Design DNA

Không có spinner/nút phụ/watermark trong thẻ module. Link prefetch shell theo Next; hover/focus/touch bật full prefetch cho route có chủ đích. Bỏ React ViewTransition và JS translate/fade trên toàn vùng nội dung. Page loading dùng thanh mảnh chung, trễ 200ms; action loading vẫn có phản hồi.

Lối quay về gateway nằm cạnh thương hiệu; breadcrumb giữ ngữ cảnh, sidebar chỉ có nghiệp vụ trong module. Nền vận hành xám trung tính/bề mặt trắng dùng token chung; màu thương hiệu vẫn lấy từ cấu hình. Marketing có page override trong Design DNA.

Số đo click→heading trong browser là mẫu local sau hover prefetch 500ms, không phải SLA, dữ liệu benchmark trước/sau hoặc cam kết mạng thực. Thời gian truy vấn/RSC và lần biên dịch đầu của dev server vẫn tồn tại. Xem report đợt này để biết route và viewport đã kiểm tra.
