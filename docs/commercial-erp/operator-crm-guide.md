# CRM triển khai dành cho team setup

## Hai không gian riêng

**Trung tâm triển khai** (`/control-center`) thuộc đội DTech cung cấp dịch vụ. Nó giữ data đăng ký, hồ sơ khách hàng, khảo sát và kế hoạch custom/triển khai. Đây không phải module bán hàng/CRM giao cho doanh nghiệp sử dụng ERP.

**ERP khách hàng** có bản triển khai và Supabase riêng. Trong ERP đó, `/system-admin/setup` chỉ cấu hình chính doanh nghiệp đang vận hành. Lưu hồ sơ trong CRM DTech không gọi API settings/Auth của khách hàng và không đổi cấu hình ERP DTech.

| Không gian | Địa chỉ | Quyền |
| --- | --- | --- |
| Team setup đăng nhập | `/control-center/login` | Tài khoản DTech có quyền CRM |
| Khách hàng và triển khai | `/control-center/customers` | `crm.view` |
| Tạo/sửa hồ sơ, hoạt động, xuất manifest | Hồ sơ khách hàng | `crm.manage` |
| Tiếp nhận đăng ký | `/control-center/trials` | `crm.view` + `trial_request.view` |
| Xử lý đăng ký | Cùng danh sách | Thêm `trial_request.manage` |
| Chuyển đăng ký thành khách hàng | Yêu cầu đã phù hợp | Toàn bộ các quyền trên |
| Khách vào ERP riêng | `https://<customer-origin>/login` | Tài khoản ở database khách hàng |

Role `deployment_team` có bốn quyền CRM/tiếp nhận; không có `system_admin.access`. Migration đăng ký role và cấp quyền cho role, không tạo user hoặc tự gán nhân sự vào role. Admin DTech hiện có được cấp quyền CRM. Tài khoản nhân sự setup có thể được tạo và gán role qua quản lý tài khoản hiện hữu.

## Cấu hình triển khai

- Chỉ bản DTech bật `DTECH_CONTROL_CENTER_ENABLED=true` trong biến môi trường máy chủ; không phải biến `NEXT_PUBLIC`.
- Bản khách hàng để `false` (mặc định). CRM page/API và intake bị chặn; trang gốc chuyển đến đăng nhập, không hiện landing sản phẩm hay link đăng ký DTech trong màn đăng nhập.
- Khi chọn file môi trường riêng, CLI không kế thừa cờ bật CRM từ process DTech; configure đặt false cho bản khách hàng, validator từ chối bật CRM trên customer target.
- CRM không nằm trong registry module ERP, không được thêm vào gói ngành hoặc sidebar nghiệp vụ khách hàng.

## Luồng vận hành

1. Khách điền doanh nghiệp, loại hình, mã số thuế/website nếu có, người liên hệ/chức vụ, điện thoại/email, ngành, nhân sự/chi nhánh, địa chỉ, công cụ, nhu cầu, thời điểm triển khai và consent. Tên công ty tối đa 120, liên hệ 100 theo hợp đồng cấu hình ERP. Cấu trúc khảo sát được giữ cùng yêu cầu; chưa tạo tài khoản khi gửi.
2. Team xác nhận đã liên hệ, ghi nhận khảo sát và chuyển yêu cầu sang “Phù hợp dùng thử”. Mỗi lệnh kiểm tra phiên bản và audit cùng transaction.
3. “Chuyển sang hồ sơ khách hàng” sao chép dữ liệu liên hệ/khảo sát. `source_request_id` duy nhất và lock trong transaction bảo đảm hai người chuyển cùng yêu cầu chỉ tạo một khách hàng. Retry trả về hồ sơ liên kết, không ghi đè cấu hình đã custom. Yêu cầu gốc và consent vẫn được giữ nguyên.
4. Khách từ kênh khác có thể được tạo trực tiếp. Hồ sơ có nhân sự phụ trách, lịch liên hệ tiếp theo, ghi chú/cuộc gọi/email/cuộc hẹn và lịch sử thay đổi. Ghi nhận Email chỉ lưu hoạt động, không gửi thư.
5. Chọn gói ngành từ cùng registry hiện có: đa ngành, xây dựng, may mặc, thương mại, dịch vụ. Team điều chỉnh module và ghi luồng nghiệp vụ riêng. Chỉ module thực có được bật; nhu cầu ngoài phạm vi hiện có được ghi lại để khảo sát/phát triển riêng.
6. Nhập target riêng, domain ERP, thông tin admin và khoảng dùng thử. Chọn giai đoạn phù hợp. Team xác nhận checklist sau khi đã thực hiện triển khai và kiểm tra thực tế.
7. Tải manifest JSON từ dữ liệu đã lưu. Manifest dùng được với `deployment:validate/plan`, configure/bootstrap và activation CLI đã có; thêm địa chỉ, điện thoại/email và mã số thuế vào organization patches. Branding chứa tên hệ thống và bộ tài sản rỗng rõ ràng; người đại diện chưa cung cấp để rỗng. Nhờ đó activation của khách mới xóa nhận diện/asset mẫu cũ trong settings thay vì kế thừa tên phụ/logo. Manifest không có mật khẩu, service key hay secret.
8. Tạo/link Supabase riêng, áp migrations, cấu hình môi trường riêng, bootstrap admin và prepare/review/apply activation theo runbook hiện hữu. Sau đó team xác nhận kiểm tra phân quyền và dữ liệu dùng thử, chuyển sang “Đang dùng thử”, bàn giao login URL qua kênh đã thống nhất. Khi nghiệm thu, chuyển “Đã bàn giao”.

Sau khi gửi form, trang xác nhận chỉ hiển thị mã yêu cầu và thông báo sẽ nhận đường dẫn ERP/tài khoản trong bàn giao. Nó không tự dẫn khách sang `/login` của DTech: tài khoản khách thuộc môi trường riêng.

## Quy tắc dữ liệu

- Hai bảng CRM private/RLS; service chỉ được SELECT trực tiếp. Lệnh ghi SECURITY DEFINER kiểm tra actor active/quyền trong database, không nhận actor từ request body. API kiểm tra cờ operator/quyền trước parse hoặc đọc hồ sơ.
- Draft được lưu ở server khi bấm lưu; form chưa lưu chỉ ở bộ nhớ trang, không lưu PII/secret vào localStorage/sessionStorage.
- Sửa hồ sơ dùng CAS. Kết quả mơ hồ hoặc conflict khóa form đến khi tải lại; không tự báo thành công. Activity có UUID để DB nhận diện retry. Tạo thủ công giữ UUID hồ sơ để CAS ngăn tạo trùng sau timeout.
- Khi đổi target/module/nhận diện triển khai, xác nhận cũ bị vô hiệu hóa. Sửa cấu hình phải lưu trước khi xác nhận lại checklist; nếu đang trial/active cần quay về giai đoạn cấp môi trường để triển khai lại.
- Target project, deployment ID và origin duy nhất theo hồ sơ. API chuẩn hóa origin HTTPS trước lưu. Ba project DTech/cũ được bảo vệ; không thể dùng làm customer target.
- Danh sách khách hàng và yêu cầu đều phân trang server 25 hàng. Khách hàng tìm theo công ty/liên hệ/email/điện thoại/MST; yêu cầu tìm theo công ty. Activity hiển thị 100 gần nhất.
- Yêu cầu cũ mở trước nâng cấp vẫn retry được với payload cũ. Hồ sơ chuyển từ tên công ty/liên hệ cũ vượt giới hạn cấu hình sử dụng phần đầu tương ứng; dữ liệu gốc đầy đủ vẫn ở yêu cầu tiếp nhận.

## Giới hạn triển khai

Checklist là xác nhận của operator, không phải bằng chứng tự động đã tạo cloud project, phát hành web, gửi email hoặc tạo Auth user. Khoảng dùng thử phục vụ theo dõi, chưa tự khóa tài khoản khi hết hạn. CRM không lưu credentials; không đăng nhập hộ khách hoặc đọc dữ liệu nghiệp vụ database khách hàng.

Các nhu cầu xây dựng như dự toán/nghiệm thu/kế toán công trình, sản xuất may, bán hàng hay kế toán tổng hợp ngoài registry hiện có vẫn là phạm vi phát triển riêng. CRM triển khai không làm những nghiệp vụ này trở thành tính năng ERP đã có.

## Kiểm tra

`npm run test:crm:integration` tạo PostgreSQL native tạm, áp migrations thực, kiểm tra actor/quyền/CAS/rollback/ACL/chuyển lead và hai kết nối tranh chấp rồi tắt cluster. Không dùng cloud credentials.

`npm run smoke:crm` chạy với localhost; dùng tài khoản DTech hiện có và chặn mọi lệnh ghi khách hàng/nghiệp vụ bằng fixture trước network. Chỉ đăng nhập/đăng xuất thực. Bằng chứng migration development và native checks trong `evidence/operator-crm-*.json`.
