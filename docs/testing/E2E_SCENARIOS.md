## Luồng vận hành và kết quả mong đợi

Các luồng API dùng session Supabase/app_sessions thật. BROWSER là thao tác trình duyệt; API không chứng minh mọi click UI.

| Nhóm | Luồng / kỳ vọng |
|---|---|
| Auth/RBAC | Login/logout, 8 API deny, disabled/enable, session thật |
| HR | Tạo/sửa nhân viên, duplicate/validation, hợp đồng, bảo hiểm |
| Công cá nhân | GPS/photo/check-in/out, replay một record, chặn đọc khác chủ |
| Nghỉ phép | Cấp12, submit/approve, ledger trừ1, replay không trừ hai lần, reject/withdraw/PDF; số dư toàn công ty đúng11 ngày và tải dưới10s |
| Công/lương | Kỳ riêng, recompute/correction/lock, net13.300.000, review/lock/publish/PDF/XLSX |
| Ca/lịch | Tạo/đổi phiên bản ca, gán ca và ngày nghỉ chỉ cho nhân viên E2E |
| Công trường | Scope riêng, update/issue/progress, checklist/ảnh điểm danh/submit/đóng ngày |
| Kho | Nhập100/xuất30/chuyển20/điều chỉnh-5/đảo xuất → kho chính75; ledger/idempotency/reconcile |
| XNK | Hợp đồng/lô hàng, ETA/rowVersion, nhận4+6 →10, hải quan; tồn85 rồi kiểm kê83 |
| Nền tảng | Chat, thông báo QA, audit, ghi chú/to-do riêng, tài liệu/version/archive, report template/XLSX |
| Tích hợp | Service account/key scopes/rotate/revoke, webhook giả lập, chặn delivery trước network |
| Tester | Gate/Quick Login/switch, session cũ401, refresh, hai kỹ sư scope riêng, không giả role |
| UI | 140 route tĩnh desktop/mobile, settings360–1920, payroll/payslip/form HR, slow/offline |

## Giới hạn và phần còn cần bổ sung

- Luồng ghi và tester thật đã chạy trên Supabase Free riêng `CT_NoiBo_Test`. Xem [kết quả thực tế](RESULTS_2026-10-08.md); catalog không thay thế report của lượt chạy.
- Payroll dùng kỳ riêng và điều chỉnh roster một người để đối soát chính xác; chưa mô phỏng payroll toàn công ty.
- SCREEN bỏ qua dynamic routes; chỉ các chi tiết tương ứng được mở trong workflow. SCREEN không chứng minh CRUD.
- Chưa tự động hóa mọi cấu hình tổ chức/global settings, inbound integration/device, approval delegation, restore backup và mọi UI action.
- API key CRUD có kiểm tra scopes/hash/revoke nhưng chưa gọi mọi external API với Bearer token. Protection Basic Auth staging cần cấu hình gateway phù hợp nếu thử external API.
- Slow/offline kiểm tra feedback tải dữ liệu; chưa chứng minh đồng bộ offline dài ngày hoặc mọi conflict.
- Thông báo là nội bộ giả lập. Không gửi email/webhook bên ngoài. Ledger/audit giữ trên database test; API keys/service accounts/webhooks do lượt chạy tạo được khóa sau test.

## Chạy

Xem [khởi tạo DEV/STAGING](DEV_STAGING_TESTING.md). Sau seed verify/server test sẵn sàng: `npm run test:e2e:business`. Report ở `test-results/e2e/<runId>`; storageState chứa cookie, không publish. Thiếu prerequisite được ghi BLOCKED; FAIL/BLOCKED làm runner exit1.
