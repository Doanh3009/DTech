# PR draft: DEV/STAGING và hệ thống kiểm thử

Branch: `feat/dev-staging-test-platform`.

## Thay đổi

- Policy server environment/target/secrets; chặn test account trên production.
- Quick Login/Test Switcher dùng Auth/session/RBAC hiện hữu; cổng tester và Basic Auth staging.
- Switcher thu gọn dùng một ô chọn tài khoản, giữ lựa chọn hiện tại và trạng thái tải riêng; không hiện lại ô nhập mã trong lúc kiểm tra grant.
- Seed 10 QA accounts/bốn QA profiles/cohort 50/công trường riêng/dữ liệu cá nhân/private files; ownership/verify/reset an toàn.
- Provision Supabase test Free độc lập `CT_NoiBo_Test` (`lgmlkagcytfjazulgfbz`) ở Singapore; script quản lý tổ chức cố định, quota Free, manifest owner, env riêng và che secrets. Bootstrap có xác nhận ref, guard/checksum migration, tiếp tục chạy sau gián đoạn và audit tồn kho; giữ SQL seed/chứng từ đã áp dụng.
- Playwright 241 ca, reports/screenshot/storageState, khóa account E2E sau chạy; ba regression readiness chạy riêng.
- Catalog cấu hình tải server/lọc local, sửa viền focus chồng, lazy load ChatDock launcher.
- Số dư phép đọc theo lô có pagination thay cho truy vấn từng nhân viên/loại phép; giữ công thức và quyền, live285 số dư/95 nhân viên đạt573ms. Sửa recipient FK thông báo, loading phiếu lương, thẻ lương mobile trùng và link JSON document.
- Unit/security tests và tài liệu tiếng Việt.
- Docker seed được tạo thành bản riêng: preflight/postcondition ba demo identities và repair bốn snapshot mẫu; không đổi checksum seed/migration remote.
- Bỏ password mặc định trong 23 QA scripts; password lấy từ env private qua helper chung.

## Kiểm tra

Ngày 08/10/2026, project test Free `ACTIVE_HEALTHY` đã nhận 39 migration và SQL seed. Bootstrap chạy lại bỏ qua các bước đã áp dụng, checksum migration/audit tồn kho PASS; `test:seed` chạy lặp lại exit code 0. Verify thực tế gồm 10 QA accounts với Auth/role, cohort 50 với dữ liệu HR/công/lương, 1.992 attendance, 25 leave, hai dự án QA với scope kỹ sư, hai PNG và bốn PDF private có checksum hợp lệ.

Lint, TypeScript và webpack build bằng cấu hình test PASS với 281 static pages; quality gate ngày 09/10 có 645 unit tests PASS (37 skip), ba browser readiness regression PASS. App test dùng `http://localhost:3300`. Business E2E `20261009ec2c4f` hoàn tất **243 PASS, 0 FAIL, 0 BLOCKED**, gồm SETUP/SEAL và thao tác trực tiếp qua switcher thu gọn. Docker CLI chưa có trong PATH; local bootstrap đã có 27 unit tests nhưng chưa chạy Docker thật. Staging HTTPS chưa deploy, hosting/domain còn chờ. Xem [kết quả thực tế và phạm vi kiểm thử](RESULTS_2026-10-08.md).

## Cần review

- Bốn profile QA theo permission hiện hữu, không đổi quyền canonical roles.
- Cấp gate/Basic Auth/secrets theo hosting environment.
- Account test hiện hữu bị chặn production; không tự xóa dữ liệu cũ.
- Payroll E2E một người và snapshot legacy không thay thế nghiệp vụ toàn công ty.
- Manifest/env/reports chứa secrets phải giữ private; dùng lại project hiện tại không cần tạo project khác, không cấp quyền nâng gói hoặc tài nguyên trả phí.

## Git

Branch riêng đã tạo. Workspace có UI/seed changes từ yêu cầu trước; giữ nguyên để không mất việc người dùng. Chưa commit/push hoặc mở PR GitHub. Đây là nội dung PR để review, chưa phải PR xuất bản. Trước khi commit, tách phần UI/phân quyền trước đó khỏi testing nếu cần.

Không deploy production.
