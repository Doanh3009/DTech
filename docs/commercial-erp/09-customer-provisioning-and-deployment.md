# Provisioning và bàn giao

Nguồn đang chạy: `scripts/database/configure.mjs`, `bootstrap-admin.mjs`, `verify.mjs`, `supabase/deployments/dtech-erp.json`; deployment runbook ở `docs/operations/deployment.md`.

Manifest DTech v1 giữ project, tên và admin hiện có. Thêm `customer.example.json` cho cấu hình may mặc minh họa; đây không phải một database đã tạo. Registry module/gói ngành dùng chung với ứng dụng. Schema strict kiểm tra target/URL, module, metadata khách hàng, locale, admin và cấm development seed; danh sách project bảo vệ trong code không thể bị gỡ bằng manifest.

`npm run deployment:validate` và `npm run deployment:plan` chạy local, không mở secret file, gọi cloud hoặc ghi cấu hình. Preview có fingerprint cấu hình/migrations và toàn bộ flag bật/tắt. Công cụ configure/bootstrap/verify nhận manifest và file môi trường riêng; bootstrap lấy username/tên/mã nhân viên từ manifest, không còn cố định theo DTech. Xem [hợp đồng và lệnh triển khai](deployment-manifest-guide.md).

Đã bổ sung wizard bốn bước có bản nháp trình duyệt và activation settings nguyên tử. CLI `deployment:activation` hỗ trợ preview → prepare snapshot hiện tại → apply reviewed plan qua cùng RPC; không reset field ngoài manifest. Có native PostgreSQL concurrency/rollback tests và kiểm tra wizard thực trên DTech development. **Chưa là installer hoàn chỉnh:** còn rehearsal toàn bộ Supabase stack, nâng cấp/khôi phục, server checkpoint và nghiệm thu hai instance. Mật khẩu/API keys đi qua secret store/env/stdin, không nằm trong manifest; writer dotenv kiểm tra roundtrip.

Trình tự operator: validate manifest → kiểm tra target/backup → migration plan → cài isolated instance được phê duyệt → customer settings → admin bootstrap → health/smoke → bàn giao. Không chạy seed development trong production.

P0 và đợt P1/P2 foundation không tạo project, đổi secret, push migration hoặc deploy production; chưa chạy lại công cụ bootstrap/configure/verify trên cloud. Browser regression chỉ tạo/kết thúc phiên kiểm tra và đọc ứng dụng, không tạo chứng từ nghiệp vụ. Các project khách hàng cũ không được ghi đè. Customer-hosted/Docker chưa có package được nghiệm thu; không quảng bá là đã hỗ trợ.

Đợt activation ngày 22/10/2026 đã áp dụng đúng migration `202610210002` vào project DTech development sau preflight/dry-run. Browser tạo một command bốn nhóm có giá trị ngữ nghĩa giữ nguyên, kiểm tra retry không tăng version và conflict không ghi dữ liệu. Xem [rollout evidence](evidence/activation-rollout.json). Không phát hành ứng dụng production hoặc tạo chứng từ nghiệp vụ.
