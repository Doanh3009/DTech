# E2E cases CT_NOIBO

**246 ca đã đăng ký**. Đây không phải kết quả pass. Loại: {"BROWSER + API":4,"API":90,"BROWSER":152}.

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


## Catalog tự động

| Mã | Loại | Tình huống |
|---|---|---|
| AUTH-01 | BROWSER + API | API yêu cầu đăng nhập và trang được chuyển về đăng nhập |
| AUTH-02 | API | Mật khẩu sai bị từ chối |
| RBAC-01 | API | employee bị chặn /api/v1/employees |
| RBAC-02 | API | employee bị chặn /api/v1/accounting/salaries |
| RBAC-03 | API | employee bị chặn /api/v1/accounting/payroll |
| RBAC-04 | API | employee bị chặn /api/v1/warehouse/inventory |
| RBAC-05 | API | employee bị chặn /api/v1/shipments |
| RBAC-06 | API | employee bị chặn /api/v1/audit-log |
| RBAC-07 | API | employee bị chặn /api/v1/settings-catalog |
| RBAC-08 | API | warehouse bị chặn /api/v1/accounting/salaries |
| HR-01 | API | Tạo nhân viên và tìm lại trong danh sách |
| HR-02 | API | Không tạo trùng mã nhân viên |
| HR-03 | API | Dữ liệu nhân viên sai bị chặn |
| HR-04 | API | Sửa hồ sơ có phiên bản và đọc lại |
| HR-05 | API | Tạo hợp đồng nhân viên mới và đọc lại |
| HR-06 | API | Ghi nhận tham gia bảo hiểm và đối chiếu hồ sơ |
| ATT-01 | API | Chấm vào với GPS tại địa điểm cho phép |
| ATT-02 | API | Gửi lại thao tác chấm công không tạo lượt mới |
| ATT-03 | API | Tải ảnh chấm công và đồng bộ hoàn tất |
| ATT-04 | API | Chấm ra rồi chặn lượt thứ ba trong ngày |
| ATT-05 | API | Thời gian/GPS không hợp lệ và truy cập chéo hồ sơ bị chặn |
| LEAVE-01 | API | Tạo luồng duyệt và loại phép riêng |
| LEAVE-02 | API | Nhân viên tạo đơn nháp rồi gửi duyệt |
| LEAVE-03 | API | Nhân viên khác không đọc được đơn cá nhân |
| LEAVE-04 | API | Người được chỉ định duyệt, sổ phép trừ đúng một ngày |
| LEAVE-05 | API | Duyệt lại trả cùng kết quả và không trừ phép lần hai |
| LEAVE-06 | API | Tải phiếu nghỉ phép PDF thật |
| LEAVE-07 | API | Đơn mới được từ chối kèm lý do |
| LEAVE-08 | API | Rút đơn đang chờ duyệt |
| LEAVE-09 | API | Tổng hợp số dư toàn công ty giữ đúng phép và phản hồi dưới 10 giây |
| TIME-01 | API | Tạo kỳ công riêng, không đụng kỳ đang vận hành |
| TIME-02 | API | Tổng hợp công và điều chỉnh công của nhân viên E2E |
| TIME-03 | API | Khóa công, chặn tổng hợp lại, mở khóa có lý do rồi khóa lại |
| PAY-01 | API | Lưu mức lương hiệu lực và đọc lịch sử |
| PAY-02 | API | Lập và tính bảng lương từ kỳ công khóa |
| PAY-03 | API | Chặn cập nhật bằng phiên bản cũ |
| PAY-03B | API | Sửa dòng đã kiểm tra buộc kiểm tra lại và đổi phiên bản kỳ lương |
| PAY-03C | API | Hai thao tác đồng thời chỉ một phiên bản được ghi |
| PAY-04 | API | Kiểm tra → khóa → phát hành đúng nhân viên E2E |
| PAY-05 | API | Bảng lương phát hành không tính lại được |
| PAY-06 | API | Không đọc được phiếu lương của người khác |
| PAY-07 | API | Xuất bảng lương XLSX và phiếu lương PDF |
| PAY-08 | API | Nhân viên xác nhận phiếu đã gửi; thao tác lặp không tạo xác nhận mới |
| PAY-09 | API | Khóa lương bảo vệ dòng lương và chặn mở công trước khi mở lại lương |
| PAY-10 | API | Mở lại thu hồi phiếu cũ; công đổi phiên bản buộc tính lại |
| PROJECT-01 | API | Tạo gói, công trường và phân công đúng phạm vi |
| PROJECT-02 | API | Tạo nhật ký có vấn đề và cập nhật tiến độ |
| PROJECT-03 | API | Xử lý vấn đề rồi mở lại có lý do |
| WORKER-01 | API | Mở phiên điểm danh có roster và chống ghi trùng |
| WORKER-02 | API | Chưa đủ checklist/ảnh thì không được gửi điểm danh |
| WORKER-03 | API | Lưu trạng thái công nhân và nội dung công việc |
| WORKER-04 | API | Đồng bộ đủ ảnh điểm danh theo chính sách |
| WORKER-05 | API | Gửi điểm danh và chốt ngày với ngoại lệ nửa ngày |
| WH-01 | API | Tạo hàng hóa, đơn vị tính và hai kho riêng |
| WH-02 | API | Nhập 100 và gửi ghi sổ lại không tăng tồn lần hai |
| WH-03 | API | Phiếu đã ghi sổ không được sửa |
| WH-04 | API | Xuất 30, chuyển 20, đối chiếu tồn hai kho |
| WH-05 | API | Xuất vượt tồn bị chặn và tồn không thay đổi |
| WH-06 | API | Điều chỉnh giảm 5 kèm lý do |
| WH-07 | API | Đảo phiếu xuất và hoàn đúng 30 về kho |
| WH-08 | API | Sổ kho đối chiếu với tồn |
| XNK-01 | API | Nhà cung cấp → hợp đồng → lô hàng |
| XNK-02 | API | Cập nhật ETA có lịch sử và chặn phiên bản cũ |
| XNK-03 | API | Tiếp nhận một phần, ghi sổ kho và kiểm tra phần còn lại |
| XNK-04 | API | Không nhận vượt số lượng còn lại |
| XNK-05 | API | Xử lý vướng mắc hải quan rồi thông quan |
| XNK-06 | API | Nhận nốt 6 hàng và đối chiếu đủ 10 trên sổ nhận/kho |
| WH-09 | API | Kiểm kê 85 → 83, ghi sổ đúng chênh lệch và chống ghi lại |
| CHAT-01 | API | Tạo hội thoại riêng, gửi và đọc lại tin nhắn |
| CHAT-02 | API | Người ngoài hội thoại không đọc được tin |
| NOTICE-01 | API | Thông báo chỉ gửi nhóm vai trò E2E, người nhận đọc lại |
| AUDIT-01 | API | Có audit cho hành động E2E và nhân viên không đọc được audit |
| SESSION-01 | API | Khóa tài khoản làm phiên cũ mất hiệu lực, mở lại đăng nhập được |
| SHIFT-01 | API | Tạo ca riêng và đọc lại cấu hình ca |
| SHIFT-02 | API | Gán ca và ngày nghỉ chỉ cho nhân viên E2E |
| SHIFT-03 | API | Đổi phiên bản ca có ngày/lý do; chặn giờ sai |
| DOC-01 | API | Upload tài liệu hư cấu và kiểm tra file riêng |
| DOC-02 | API | Thay file giữ đủ hai phiên bản và file cũ |
| DOC-03 | API | Chặn nhân viên lưu trữ tài liệu; Admin archive và chặn lặp |
| REPORT-01 | API | Tạo và sửa mẫu báo cáo riêng theo phiên bản |
| REPORT-02 | API | Xuất kỳ công thật thành XLSX; người khác không tải được |
| REPORT-03 | API | Chặn xuất thiếu kỳ và mẫu không tồn tại |
| WORKSPACE-01 | API | Ghi chú cá nhân không xuất hiện ở tài khoản khác |
| WORKSPACE-02 | API | Tạo việc cá nhân và chặn sửa/xóa khác chủ |
| WORKSPACE-03 | API | Hoàn thành/xóa việc cá nhân và validation tiêu đề |
| INTEGRATION-01 | API | Tạo service account riêng với scope thực |
| INTEGRATION-02 | API | API key chỉ nhận scope service account; secret không lưu plaintext |
| INTEGRATION-03 | API | Rotate key thu hồi khóa cũ và revoke khóa mới |
| INTEGRATION-04 | API | Đăng ký webhook hư cấu; không cấu hình provider thật |
| INTEGRATION-05 | API | Gửi thử bị chặn trước network; không có delivery attempt |
| TESTER-01 | BROWSER + API | Thiếu cổng tester thì API đăng nhập nhanh bị chặn |
| TESTER-02 | BROWSER | Mở cổng tester và đăng nhập nhanh bằng nút trên điện thoại |
| TESTER-03 | BROWSER + API | Chuyển admin → nhân viên thu hồi phiên trước và tải lại đúng quyền |
| TESTER-04 | BROWSER + API | Kỹ sư chỉ truy cập gói được phân công, API gói khác trả 404 |
| TESTER-05 | API | Request sửa role không nâng quyền và tài khoản ngoài whitelist bị chặn |
| TESTER-06 | BROWSER | API chậm hiển thị trạng thái tải rồi trả dữ liệu; offline có phản hồi |
| SCREEN-001 | BROWSER | Mở /accounting trên desktop và điện thoại |
| SCREEN-002 | BROWSER | Mở /accounting/payroll trên desktop và điện thoại |
| SCREEN-003 | BROWSER | Mở /accounting/payslips trên desktop và điện thoại |
| SCREEN-004 | BROWSER | Mở /accounting/salaries trên desktop và điện thoại |
| SCREEN-005 | BROWSER | Mở /accounting/salary-history trên desktop và điện thoại |
| SCREEN-006 | BROWSER | Mở /applications trên desktop và điện thoại |
| SCREEN-007 | BROWSER | Mở /approvals trên desktop và điện thoại |
| SCREEN-008 | BROWSER | Mở /approvals/completed trên desktop và điện thoại |
| SCREEN-009 | BROWSER | Mở /approvals/delegated trên desktop và điện thoại |
| SCREEN-010 | BROWSER | Mở /approvals/leave trên desktop và điện thoại |
| SCREEN-011 | BROWSER | Mở /approvals/pending trên desktop và điện thoại |
| SCREEN-012 | BROWSER | Mở /attendance trên desktop và điện thoại |
| SCREEN-013 | BROWSER | Mở /attendance/history trên desktop và điện thoại |
| SCREEN-014 | BROWSER | Mở /attendance/logs trên desktop và điện thoại |
| SCREEN-015 | BROWSER | Mở /attendance/me trên desktop và điện thoại |
| SCREEN-016 | BROWSER | Mở /attendance/notifications trên desktop và điện thoại |
| SCREEN-017 | BROWSER | Mở /attendance/quick trên desktop và điện thoại |
| SCREEN-018 | BROWSER | Mở /attendance/records trên desktop và điện thoại |
| SCREEN-019 | BROWSER | Mở /attendance/requests trên desktop và điện thoại |
| SCREEN-020 | BROWSER | Mở /attendance/today trên desktop và điện thoại |
| SCREEN-021 | BROWSER | Mở /command trên desktop và điện thoại |
| SCREEN-022 | BROWSER | Mở /dashboard trên desktop và điện thoại |
| SCREEN-023 | BROWSER | Mở /dashboard/hr trên desktop và điện thoại |
| SCREEN-024 | BROWSER | Mở /dashboard/import-export trên desktop và điện thoại |
| SCREEN-025 | BROWSER | Mở /dashboard/management trên desktop và điện thoại |
| SCREEN-026 | BROWSER | Mở /dashboard/warehouse trên desktop và điện thoại |
| SCREEN-027 | BROWSER | Mở /documents trên desktop và điện thoại |
| SCREEN-028 | BROWSER | Mở /documents/recent trên desktop và điện thoại |
| SCREEN-029 | BROWSER | Mở /documents/shared trên desktop và điện thoại |
| SCREEN-030 | BROWSER | Mở /employees trên desktop và điện thoại |
| SCREEN-031 | BROWSER | Mở /employees/contracts trên desktop và điện thoại |
| SCREEN-032 | BROWSER | Mở /employees/departments trên desktop và điện thoại |
| SCREEN-033 | BROWSER | Mở /employees/insurance trên desktop và điện thoại |
| SCREEN-034 | BROWSER | Mở /employees/new trên desktop và điện thoại |
| SCREEN-035 | BROWSER | Mở /employees/positions trên desktop và điện thoại |
| SCREEN-036 | BROWSER | Mở /home trên desktop và điện thoại |
| SCREEN-037 | BROWSER | Mở /import-export trên desktop và điện thoại |
| SCREEN-038 | BROWSER | Mở /import-export/contracts trên desktop và điện thoại |
| SCREEN-039 | BROWSER | Mở /import-export/contracts/new trên desktop và điện thoại |
| SCREEN-040 | BROWSER | Mở /import-export/customs trên desktop và điện thoại |
| SCREEN-041 | BROWSER | Mở /import-export/documents trên desktop và điện thoại |
| SCREEN-042 | BROWSER | Mở /import-export/partners trên desktop và điện thoại |
| SCREEN-043 | BROWSER | Mở /import-export/shipments trên desktop và điện thoại |
| SCREEN-044 | BROWSER | Mở /import-export/shipments/new trên desktop và điện thoại |
| SCREEN-045 | BROWSER | Mở /import-export/transport trên desktop và điện thoại |
| SCREEN-046 | BROWSER | Mở /leave trên desktop và điện thoại |
| SCREEN-047 | BROWSER | Mở /leave/adjustments trên desktop và điện thoại |
| SCREEN-048 | BROWSER | Mở /leave/balance trên desktop và điện thoại |
| SCREEN-049 | BROWSER | Mở /leave/balances trên desktop và điện thoại |
| SCREEN-050 | BROWSER | Mở /leave/manage trên desktop và điện thoại |
| SCREEN-051 | BROWSER | Mở /leave/manage/adjustments trên desktop và điện thoại |
| SCREEN-052 | BROWSER | Mở /leave/manage/balances trên desktop và điện thoại |
| SCREEN-053 | BROWSER | Mở /leave/my-requests trên desktop và điện thoại |
| SCREEN-054 | BROWSER | Mở /leave/new trên desktop và điện thoại |
| SCREEN-055 | BROWSER | Mở /messages trên desktop và điện thoại |
| SCREEN-056 | BROWSER | Mở /notifications trên desktop và điện thoại |
| SCREEN-057 | BROWSER | Mở /notifications/unread trên desktop và điện thoại |
| SCREEN-058 | BROWSER | Mở /personal trên desktop và điện thoại |
| SCREEN-059 | BROWSER | Mở /personal/payslips trên desktop và điện thoại |
| SCREEN-060 | BROWSER | Mở /profile trên desktop và điện thoại |
| SCREEN-061 | BROWSER | Mở /project-monitoring trên desktop và điện thoại |
| SCREEN-062 | BROWSER | Mở /project-monitoring/issues trên desktop và điện thoại |
| SCREEN-063 | BROWSER | Mở /project-monitoring/recent trên desktop và điện thoại |
| SCREEN-064 | BROWSER | Mở /projects trên desktop và điện thoại |
| SCREEN-065 | BROWSER | Mở /projects/new trên desktop và điện thoại |
| SCREEN-066 | BROWSER | Mở /projects/updates trên desktop và điện thoại |
| SCREEN-067 | BROWSER | Mở /reports trên desktop và điện thoại |
| SCREEN-068 | BROWSER | Mở /search trên desktop và điện thoại |
| SCREEN-069 | BROWSER | Mở /search/results trên desktop và điện thoại |
| SCREEN-070 | BROWSER | Mở /settings trên desktop và điện thoại |
| SCREEN-071 | BROWSER | Mở /settings/approval-delegations trên desktop và điện thoại |
| SCREEN-072 | BROWSER | Mở /settings/approval-workflows trên desktop và điện thoại |
| SCREEN-073 | BROWSER | Mở /settings/attendance trên desktop và điện thoại |
| SCREEN-074 | BROWSER | Mở /settings/attendance/calendar trên desktop và điện thoại |
| SCREEN-075 | BROWSER | Mở /settings/attendance/locations trên desktop và điện thoại |
| SCREEN-076 | BROWSER | Mở /settings/attendance/policies trên desktop và điện thoại |
| SCREEN-077 | BROWSER | Mở /settings/attendance/shifts trên desktop và điện thoại |
| SCREEN-078 | BROWSER | Mở /settings/audit-log trên desktop và điện thoại |
| SCREEN-079 | BROWSER | Mở /settings/export-templates trên desktop và điện thoại |
| SCREEN-080 | BROWSER | Mở /settings/import-export trên desktop và điện thoại |
| SCREEN-081 | BROWSER | Mở /settings/integrations trên desktop và điện thoại |
| SCREEN-082 | BROWSER | Mở /settings/integrations/api-docs trên desktop và điện thoại |
| SCREEN-083 | BROWSER | Mở /settings/integrations/api-keys trên desktop và điện thoại |
| SCREEN-084 | BROWSER | Mở /settings/integrations/attendance-devices trên desktop và điện thoại |
| SCREEN-085 | BROWSER | Mở /settings/integrations/conflicts trên desktop và điện thoại |
| SCREEN-086 | BROWSER | Mở /settings/integrations/imports trên desktop và điện thoại |
| SCREEN-087 | BROWSER | Mở /settings/integrations/service-accounts trên desktop và điện thoại |
| SCREEN-088 | BROWSER | Mở /settings/integrations/webhook-deliveries trên desktop và điện thoại |
| SCREEN-089 | BROWSER | Mở /settings/integrations/webhooks trên desktop và điện thoại |
| SCREEN-090 | BROWSER | Mở /settings/leave trên desktop và điện thoại |
| SCREEN-091 | BROWSER | Mở /settings/leave/policies trên desktop và điện thoại |
| SCREEN-092 | BROWSER | Mở /settings/leave/types trên desktop và điện thoại |
| SCREEN-093 | BROWSER | Mở /settings/leave/workflows trên desktop và điện thoại |
| SCREEN-094 | BROWSER | Mở /settings/notifications trên desktop và điện thoại |
| SCREEN-095 | BROWSER | Mở /settings/organization trên desktop và điện thoại |
| SCREEN-096 | BROWSER | Mở /settings/permissions trên desktop và điện thoại |
| SCREEN-097 | BROWSER | Mở /settings/roles trên desktop và điện thoại |
| SCREEN-098 | BROWSER | Mở /settings/users trên desktop và điện thoại |
| SCREEN-099 | BROWSER | Mở /settings/warehouse trên desktop và điện thoại |
| SCREEN-100 | BROWSER | Mở /shifts trên desktop và điện thoại |
| SCREEN-101 | BROWSER | Mở /shifts/calendar trên desktop và điện thoại |
| SCREEN-102 | BROWSER | Mở /system-admin trên desktop và điện thoại |
| SCREEN-103 | BROWSER | Mở /system-admin/appearance trên desktop và điện thoại |
| SCREEN-104 | BROWSER | Mở /system-admin/attendance-checklist trên desktop và điện thoại |
| SCREEN-105 | BROWSER | Mở /system-admin/audit trên desktop và điện thoại |
| SCREEN-106 | BROWSER | Mở /system-admin/branding trên desktop và điện thoại |
| SCREEN-107 | BROWSER | Mở /system-admin/config-history trên desktop và điện thoại |
| SCREEN-108 | BROWSER | Mở /system-admin/dashboard trên desktop và điện thoại |
| SCREEN-109 | BROWSER | Mở /system-admin/localization trên desktop và điện thoại |
| SCREEN-110 | BROWSER | Mở /system-admin/modules trên desktop và điện thoại |
| SCREEN-111 | BROWSER | Mở /system-admin/navigation trên desktop và điện thoại |
| SCREEN-112 | BROWSER | Mở /system-admin/notices trên desktop và điện thoại |
| SCREEN-113 | BROWSER | Mở /system-admin/operations trên desktop và điện thoại |
| SCREEN-114 | BROWSER | Mở /system-admin/organization trên desktop và điện thoại |
| SCREEN-115 | BROWSER | Mở /system-admin/payslip-template trên desktop và điện thoại |
| SCREEN-116 | BROWSER | Mở /system-admin/security trên desktop và điện thoại |
| SCREEN-117 | BROWSER | Mở /timesheets trên desktop và điện thoại |
| SCREEN-118 | BROWSER | Mở /timesheets/adjustments trên desktop và điện thoại |
| SCREEN-119 | BROWSER | Mở /timesheets/exceptions trên desktop và điện thoại |
| SCREEN-120 | BROWSER | Mở /timesheets/matrix trên desktop và điện thoại |
| SCREEN-121 | BROWSER | Mở /warehouse trên desktop và điện thoại |
| SCREEN-122 | BROWSER | Mở /warehouse/adjustments trên desktop và điện thoại |
| SCREEN-123 | BROWSER | Mở /warehouse/adjustments/new trên desktop và điện thoại |
| SCREEN-124 | BROWSER | Mở /warehouse/inventory trên desktop và điện thoại |
| SCREEN-125 | BROWSER | Mở /warehouse/issues trên desktop và điện thoại |
| SCREEN-126 | BROWSER | Mở /warehouse/issues/new trên desktop và điện thoại |
| SCREEN-127 | BROWSER | Mở /warehouse/items trên desktop và điện thoại |
| SCREEN-128 | BROWSER | Mở /warehouse/items/new trên desktop và điện thoại |
| SCREEN-129 | BROWSER | Mở /warehouse/ledger trên desktop và điện thoại |
| SCREEN-130 | BROWSER | Mở /warehouse/receipts trên desktop và điện thoại |
| SCREEN-131 | BROWSER | Mở /warehouse/receipts/new trên desktop và điện thoại |
| SCREEN-132 | BROWSER | Mở /warehouse/stock-counts trên desktop và điện thoại |
| SCREEN-133 | BROWSER | Mở /warehouse/stock-counts/new trên desktop và điện thoại |
| SCREEN-134 | BROWSER | Mở /warehouse/transfers trên desktop và điện thoại |
| SCREEN-135 | BROWSER | Mở /warehouse/transfers/new trên desktop và điện thoại |
| SCREEN-136 | BROWSER | Mở /warehouse/warehouses trên desktop và điện thoại |
| SCREEN-137 | BROWSER | Mở /warehouse/warehouses/new trên desktop và điện thoại |
| SCREEN-138 | BROWSER | Mở /worker-attendance trên desktop và điện thoại |
| SCREEN-139 | BROWSER | Mở /worker-attendance/today trên desktop và điện thoại |
| SCREEN-140 | BROWSER | Mở /workspace trên desktop và điện thoại |
| SHELL-360 | BROWSER | Khung cấu hình 360px và một viền focus |
| SHELL-390 | BROWSER | Khung cấu hình 390px và một viền focus |
| SHELL-430 | BROWSER | Khung cấu hình 430px và một viền focus |
| SHELL-1366 | BROWSER | Khung cấu hình 1366px và một viền focus |
| SHELL-1440 | BROWSER | Khung cấu hình 1440px và một viền focus |
| SHELL-1920 | BROWSER | Khung cấu hình 1920px và một viền focus |
| UI-PERSONAL | BROWSER | Nhân viên chỉ thấy Cá nhân và mở phiếu lương từ Cá nhân |
| UI-PAYROLL | BROWSER | Bảng lương lên cao và thao tác có thể chạm trên điện thoại |
| UI-HR-CREATE | BROWSER | Nhân sự tạo hồ sơ bằng form trình duyệt và mở hồ sơ vừa tạo |
| UI-AUTH | BROWSER | Đăng nhập bằng form, đăng xuất và không dùng lại phiên được |
