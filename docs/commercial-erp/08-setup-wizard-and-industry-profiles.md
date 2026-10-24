# Thiết lập doanh nghiệp

Hiện có: `src/features/system-admin/pages/ModulesPage.tsx` chọn preset, chỉnh capability và lưu versioned settings; các trang Organization/Branding/Appearance/Localization/Roles/Workflow tồn tại riêng.

Preset hiện có: general, garment, construction, trading, services. Registry dùng chung cho ứng dụng và công cụ triển khai ở `src/config/erpRegistry.json`; `erpModules.ts` giữ API TypeScript. Áp dụng preset chỉ đổi bản nháp; upgrade không tự ghi đè lựa chọn khách hàng. Planned modules được ghi chưa triển khai, không có fake link thao tác.

P1/P2 foundation đã có manifest v1, validate và preview plan chạy local; xem [hướng dẫn manifest](deployment-manifest-guide.md). Preview tạo đủ flag boolean từ lựa chọn khách hàng, chưa ghi cấu hình hoặc thay đổi database.

Đã có wizard `/system-admin/setup`: Doanh nghiệp → Thương hiệu → Module → Xác nhận. Kiểm tra từng bước, xác nhận trước xuất bản; giữ các field/logo hiện hữu. Bản nháp lưu rõ ràng trên trình duyệt theo tài khoản, app origin và Supabase origin. Tiếp tục bản nháp giữ expected versions cũ; không tự rebase khi server đã đổi. Pending command giữ request ID/body qua reload để thử lại an toàn. Bản nháp không đồng bộ liên thiết bị, không phải checkpoint server; có thể chứa liên hệ doanh nghiệp và được xóa bằng **Bỏ bản nháp**.

Xuất bản bốn nhóm bằng một RPC: CAS, settings/history/audit/receipt trong cùng transaction. Migration đã áp dụng cho DTech development; UI publish/retry/conflict đã kiểm tra trên project này. CLI có preview local, prepare chỉ đọc và apply reviewed plan; xem [hướng dẫn activation](customer-activation-guide.md). Chưa có dependency/entitlement hợp đồng, server onboarding state hoặc import onboarding thống nhất.

Acceptance P2: dừng/tiếp tục được; chạy lại không tạo trùng role/account/menu; manifest không có secret; hai instance độc lập khác tên/logo/module; không có fixture tự đổ vào production; activation không được tự gán trạng thái production-ready.
