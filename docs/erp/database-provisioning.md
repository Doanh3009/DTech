# Database riêng cho DTech ERP

## Cấu hình được chuẩn bị

- Project do chủ dự án tạo sẵn: `tcjjhxqtreemccdbvyza`.
- Dashboard: https://supabase.com/dashboard/project/tcjjhxqtreemccdbvyza.
- API: `https://tcjjhxqtreemccdbvyza.supabase.co`.
- Kế hoạch: [supabase/deployments/dtech-erp.json](../../supabase/deployments/dtech-erp.json).
- Database, Auth và Storage của DTech ERP dùng project này. Không tạo thêm project trong tổ chức Châu Tuấn.
- Đã áp dụng 54 migration nghiệp vụ và migration `202610210001_protect_document_number_sequences.sql` khóa quyền trực tiếp trên bảng bộ đếm chứng từ.

## Trạng thái ngày 21/10/2026

Đã đăng nhập và liên kết CLI với đúng project `tcjjhxqtreemccdbvyza` (tên DTech, vùng Singapore). Preflight trước khi ghi xác nhận public schema có 0 bảng, Auth có 0 người dùng, Storage có 0 bucket.

Đã áp dụng đủ 55 migration: 179 bảng public bật RLS, 15 bucket. Đã lưu nhận diện DTech và 9 capability vào database; khóa kết nối ở `.env.local` được gitignore. API health của ứng dụng trả 200/ready với database healthy. Màn login hoạt động; người chưa đăng nhập bị chuyển về login và API nghiệp vụ trả 401. Bộ đếm chứng từ chỉ cho phép server/RPC truy cập.

Chủ dự án đã xác nhận dọn fixture và yêu cầu tài khoản `admin` với mật khẩu tự chọn. Đã tạo 1 Auth user, gán vai trò `admin` và liên kết hồ sơ `SYS-DTECH-ADMIN`. Phòng ban/chức danh quản trị hệ thống được tạo để đáp ứng ràng buộc hồ sơ nhân sự. Thông tin đăng nhập chỉ lưu tại `.env.admin.local` được gitignore; không lưu mật khẩu trong mã nguồn hoặc tài liệu.

Đã kiểm tra bằng trình duyệt tại `http://localhost:3000`: đăng nhập bằng form thật thành công, chuyển đến `/applications` và hiển thị 10 module; mở được Thiết lập ERP và Design DNA. API cấu hình module và nhân sự trả 200 cho admin; sau đăng xuất, API cấu hình trả 401. Không có lỗi JavaScript trong các màn đã kiểm tra. Kết quả SQL sau khởi tạo xác nhận 1 Auth user, 55 migration, 179/179 bảng bật RLS và 15 bucket.

Đã xóa đúng fixture do migration lịch sử tự tạo: 4 nhân sự mẫu, 1 tài khoản demo chưa liên kết Auth, 1 công trường, 3 vật tư, 2 kho cùng bản ghi phụ thuộc. Sau khởi tạo, database có 1 nhân sự quản trị và 1 tài khoản; công trường, vật tư và kho đều có 0 bản ghi. Giữ các danh mục cấu hình ban đầu và ca hành chính cấp công ty. SQL dọn fixture chạy trong transaction, có guard từ chối database đã có Auth user hoặc dữ liệu ngoài bộ mẫu.

`project_id` trong `config.toml` là tên workspace local. Database cloud đích được chốt trong manifest deployment và mỗi lệnh migration dùng project ref rõ ràng.

## Quy trình nối database

1. Xác thực tài khoản có quyền vào đúng `tcjjhxqtreemccdbvyza` và kiểm tra schema/dữ liệu hiện có trước khi ghi.
2. Xác minh project ref khác cả hai ref được bảo vệ. Lưu API key vào cấu hình local bị gitignore; không in secret vào log hoặc commit.
3. Liên kết CLI với project mới, xem trước và áp dụng migrations. Không chạy `seed.sql` vì đây là bộ dữ liệu thử nghiệm.
4. Sau khi được chấp thuận, chạy `supabase/bootstrap/dtech-erp.sql` để gỡ fixture trên project đích. Script này không chạy trên database có Auth user hoặc dữ liệu ngoài bộ mẫu.
5. Khi được chủ dự án yêu cầu tạo quản trị, cung cấp mật khẩu qua `BOOTSTRAP_ADMIN_PASSWORD`, stdin (`--credentials-stdin`) hoặc `.env.admin.local` đã gitignore; chạy `node --env-file=.env.local scripts/database/bootstrap-admin.mjs` để tạo `admin`. Script chỉ nhận mật khẩu được cung cấp, không đặt mật khẩu cố định trong mã nguồn.
6. Kiểm tra health, đăng nhập thực tế, lưu cấu hình ERP và quyền truy cập trên database mới.

## Kiểm tra lại

```powershell
node scripts/database/configure.mjs --check
node --env-file=.env.local scripts/database/verify.mjs
npx supabase db query --linked --project-ref tcjjhxqtreemccdbvyza --file supabase/bootstrap/verify.sql --output json
```

Không có thao tác ghi, đổi mật khẩu, reset, pause hoặc xóa nào được thực hiện trên hai project hiện có trong bước chuẩn bị này.
