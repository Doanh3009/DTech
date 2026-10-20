# E2E 202610201aac5d

2026-10-20T03:50:09.059Z · test · http://localhost:3301

{"PASS":254,"FAIL":2,"BLOCKED":0}

| Mã | Tình huống | Loại | Kết quả | ms |
|---|---|---|---|---|
| SETUP | Dữ liệu riêng và phiên đăng nhập theo vai trò | SETUP | PASS | 13560 |
| AUTH-01 | API yêu cầu đăng nhập và trang được chuyển về đăng nhập | BROWSER + API | PASS | 453 |
| AUTH-02 | Mật khẩu sai bị từ chối | API | PASS | 589 |
| RBAC-01 | employee bị chặn /api/v1/employees | API | PASS | 130 |
| RBAC-02 | employee bị chặn /api/v1/accounting/salaries | API | PASS | 249 |
| RBAC-03 | employee bị chặn /api/v1/accounting/payroll | API | PASS | 143 |
| RBAC-04 | employee bị chặn /api/v1/warehouse/inventory | API | PASS | 134 |
| RBAC-05 | employee bị chặn /api/v1/shipments | API | PASS | 141 |
| RBAC-06 | employee bị chặn /api/v1/audit-log | API | PASS | 141 |
| RBAC-07 | employee bị chặn /api/v1/settings-catalog | API | PASS | 140 |
| RBAC-08 | warehouse bị chặn /api/v1/accounting/salaries | API | PASS | 131 |
| HR-01 | Tạo nhân viên và tìm lại trong danh sách | API | PASS | 1155 |
| HR-02 | Không tạo trùng mã nhân viên | API | PASS | 305 |
| HR-03 | Dữ liệu nhân viên sai bị chặn | API | PASS | 119 |
| HR-04 | Sửa hồ sơ có phiên bản và đọc lại | API | PASS | 1207 |
| HR-05 | Tạo hợp đồng nhân viên mới và đọc lại | API | PASS | 974 |
| HR-06 | Ghi nhận tham gia bảo hiểm và đối chiếu hồ sơ | API | PASS | 926 |
| ATT-01 | Chấm vào với GPS tại địa điểm cho phép | API | PASS | 1465 |
| ATT-02 | Gửi lại thao tác chấm công không tạo lượt mới | API | PASS | 542 |
| ATT-03 | Tải ảnh chấm công và đồng bộ hoàn tất | API | PASS | 2366 |
| ATT-04 | Chấm ra rồi chặn lượt thứ ba trong ngày | API | PASS | 1787 |
| ATT-05 | Thời gian/GPS không hợp lệ và truy cập chéo hồ sơ bị chặn | API | PASS | 469 |
| LEAVE-01 | Tạo luồng duyệt và loại phép riêng | API | PASS | 2294 |
| LEAVE-02 | Nhân viên tạo đơn nháp rồi gửi duyệt | API | PASS | 5607 |
| LEAVE-03 | Nhân viên khác không đọc được đơn cá nhân | API | PASS | 350 |
| LEAVE-04 | Người được chỉ định duyệt, sổ phép trừ đúng một ngày | API | PASS | 2323 |
| LEAVE-05 | Duyệt lại bị chặn và không trừ phép lần hai | API | PASS | 1284 |
| LEAVE-06 | Tải phiếu nghỉ phép PDF thật | API | PASS | 1081 |
| LEAVE-07 | Đơn mới được từ chối kèm lý do | API | PASS | 8711 |
| LEAVE-08 | Rút đơn đang chờ duyệt | API | PASS | 7822 |
| LEAVE-09 | Tổng hợp số dư toàn công ty giữ đúng phép và phản hồi dưới 10 giây | API | PASS | 503 |
| TIME-01 | Tạo kỳ công riêng, không đụng kỳ đang vận hành | API | PASS | 801 |
| TIME-02 | Tổng hợp công và điều chỉnh công của nhân viên E2E | API | PASS | 4503 |
| TIME-03 | Khóa công, chặn tổng hợp lại, mở khóa có lý do rồi khóa lại | API | PASS | 5213 |
| PAY-01 | Lưu mức lương hiệu lực và đọc lịch sử | API | PASS | 855 |
| PAY-02 | Lập và tính bảng lương từ kỳ công khóa | API | PASS | 2701 |
| PAY-03 | Chặn cập nhật bằng phiên bản cũ | API | PASS | 979 |
| PAY-03B | Sửa dòng đã kiểm tra buộc kiểm tra lại và đổi phiên bản kỳ lương | API | PASS | 5069 |
| PAY-03C | Hai thao tác đồng thời chỉ một phiên bản được ghi | API | PASS | 2867 |
| PAY-04 | Kiểm tra → khóa → phát hành đúng nhân viên E2E | API | PASS | 7485 |
| PAY-05 | Bảng lương phát hành không tính lại được | API | PASS | 1126 |
| PAY-06 | Không đọc được phiếu lương của người khác | API | PASS | 340 |
| PAY-07 | Xuất bảng lương XLSX và phiếu lương PDF | API | PASS | 1353 |
| PAY-08 | Nhân viên xác nhận phiếu đã gửi; thao tác lặp không tạo xác nhận mới | API | PASS | 1828 |
| PAY-09 | Khóa lương bảo vệ dòng lương và chặn mở công trước khi mở lại lương | API | PASS | 1019 |
| PAY-10 | Mở lại thu hồi phiếu cũ; công đổi phiên bản buộc tính lại | API | PASS | 28072 |
| PROJECT-01 | Tạo gói, công trường và phân công đúng phạm vi | API | PASS | 8927 |
| PROJECT-02 | Tạo nhật ký có vấn đề và cập nhật tiến độ | API | PASS | 8664 |
| PROJECT-03 | Xử lý vấn đề rồi mở lại có lý do | API | PASS | 4007 |
| WORKER-01 | Mở phiên điểm danh có roster và chống ghi trùng | API | PASS | 5103 |
| WORKER-02 | Chưa đủ checklist/ảnh thì không được gửi điểm danh | API | PASS | 1200 |
| WORKER-03 | Lưu trạng thái công nhân và nội dung công việc | API | PASS | 2351 |
| WORKER-04 | Đồng bộ đủ ảnh điểm danh theo chính sách | API | PASS | 20277 |
| WORKER-05 | Gửi điểm danh và chốt ngày với ngoại lệ nửa ngày | API | PASS | 18914 |
| WH-01 | Tạo hàng hóa, đơn vị tính và hai kho riêng | API | PASS | 6080 |
| WH-02 | Nhập 100 và gửi ghi sổ lại không tăng tồn lần hai | API | PASS | 11712 |
| WH-03 | Phiếu đã ghi sổ không được sửa | API | PASS | 908 |
| WH-04 | Xuất 30, chuyển 20, đối chiếu tồn hai kho | API | PASS | 8238 |
| WH-05 | Xuất vượt tồn bị chặn và tồn không thay đổi | API | PASS | 8105 |
| WH-06 | Điều chỉnh giảm 5 kèm lý do | API | PASS | 19040 |
| WH-07 | Đảo phiếu xuất và hoàn đúng 30 về kho | API | PASS | 6660 |
| WH-08 | Sổ kho đối chiếu với tồn | API | PASS | 1483 |
| XNK-01 | Nhà cung cấp → hợp đồng → lô hàng | API | PASS | 8599 |
| XNK-02 | Cập nhật ETA có lịch sử và chặn phiên bản cũ | API | PASS | 8155 |
| XNK-03 | Tiếp nhận một phần, ghi sổ kho và kiểm tra phần còn lại | API | PASS | 14637 |
| XNK-04 | Không nhận vượt số lượng còn lại | API | PASS | 2659 |
| XNK-05 | Xử lý vướng mắc hải quan rồi thông quan | API | PASS | 12562 |
| XNK-06 | Nhận nốt 6 hàng và đối chiếu đủ 10 trên sổ nhận/kho | API | PASS | 18661 |
| WH-09 | Kiểm kê 85 → 83, ghi sổ đúng chênh lệch và chống ghi lại | API | PASS | 11591 |
| CHAT-01 | Tạo hội thoại riêng, gửi và đọc lại tin nhắn | API | PASS | 3881 |
| CHAT-02 | Người ngoài hội thoại không đọc được tin | API | PASS | 520 |
| NOTICE-01 | Thông báo chỉ gửi nhóm vai trò E2E, người nhận đọc lại | API | PASS | 45583 |
| AUDIT-01 | Có audit cho hành động E2E và nhân viên không đọc được audit | API | PASS | 1975 |
| SESSION-01 | Khóa tài khoản làm phiên cũ mất hiệu lực, mở lại đăng nhập được | API | PASS | 7105 |
| CONCURRENT-01 | Tám vai trò đọc dữ liệu đồng thời bằng phiên riêng | API | PASS | 2539 |
| CONCURRENT-02 | Hai người cập nhật ETA cùng phiên bản: một thành công, một xung đột | API | PASS | 34545 |
| CONCURRENT-03 | Hai người sửa thông quan cùng phiên bản không ghi đè nhau | API | PASS | 5159 |
| CONCURRENT-04 | Gửi lập phiếu nhập đồng thời cùng mã yêu cầu chỉ tạo một phiếu | API | PASS | 12244 |
| CONCURRENT-05 | Ghi sổ cùng phiếu từ hai phiên chỉ tăng tồn và thực nhận một lần | API | PASS | 10222 |
| CONCURRENT-06 | Hai phiếu khác nhau ghi sổ đồng thời không nhận vượt lô hàng | API | PASS | 13286 |
| UI-SHIPMENT-NAV | Đổi cả bảy tab giữ trang, bản nháp và không tải lại dữ liệu lô hàng | BROWSER | PASS | 40363 |
| SHIFT-01 | Tạo ca riêng và đọc lại cấu hình ca | API | PASS | 2132 |
| SHIFT-02 | Gán ca và ngày nghỉ chỉ cho nhân viên E2E | API | PASS | 1411 |
| SHIFT-03 | Đổi phiên bản ca có ngày/lý do; chặn giờ sai | API | PASS | 1228 |
| DOC-01 | Upload tài liệu hư cấu và kiểm tra file riêng | API | PASS | 4135 |
| DOC-02 | Thay file giữ đủ hai phiên bản và file cũ | API | PASS | 3689 |
| DOC-03 | Chặn nhân viên lưu trữ tài liệu; Admin archive và chặn lặp | API | PASS | 2007 |
| REPORT-01 | Tạo và sửa mẫu báo cáo riêng theo phiên bản | API | PASS | 2009 |
| REPORT-02 | Xuất kỳ công thật thành XLSX; người khác không tải được | API | PASS | 4678 |
| REPORT-03 | Chặn xuất thiếu kỳ và mẫu không tồn tại | API | PASS | 3073 |
| WORKSPACE-01 | Ghi chú cá nhân không xuất hiện ở tài khoản khác | API | PASS | 2521 |
| WORKSPACE-02 | Tạo việc cá nhân và chặn sửa/xóa khác chủ | API | PASS | 1773 |
| WORKSPACE-03 | Hoàn thành/xóa việc cá nhân và validation tiêu đề | API | PASS | 1521 |
| INTEGRATION-01 | Tạo service account riêng với scope thực | API | PASS | 823 |
| INTEGRATION-02 | API key chỉ nhận scope service account; secret không lưu plaintext | API | PASS | 1859 |
| INTEGRATION-03 | Rotate key thu hồi khóa cũ và revoke khóa mới | API | PASS | 2574 |
| INTEGRATION-04 | Đăng ký webhook hư cấu; không cấu hình provider thật | API | PASS | 1024 |
| INTEGRATION-05 | Gửi thử bị chặn trước network; không có delivery attempt | API | PASS | 1236 |
| TESTER-01 | Thiếu cổng tester thì API đăng nhập nhanh bị chặn | BROWSER + API | PASS | 18 |
| TESTER-02 | Mở cổng tester và đăng nhập nhanh bằng nút trên điện thoại | BROWSER | PASS | 4970 |
| TESTER-03 | Chuyển admin → nhân viên thu hồi phiên trước và tải lại đúng quyền | BROWSER + API | PASS | 13650 |
| TESTER-04 | Kỹ sư chỉ truy cập gói được phân công, API gói khác trả 404 | BROWSER + API | PASS | 12810 |
| TESTER-05 | Request sửa role không nâng quyền và tài khoản ngoài whitelist bị chặn | API | PASS | 568 |
| TESTER-06 | API chậm hiển thị trạng thái tải rồi trả dữ liệu; offline có phản hồi | BROWSER | PASS | 3133 |
| SCREEN-001 | Mở /accounting trên desktop và điện thoại | BROWSER | PASS | 3907 |
| SCREEN-002 | Mở /accounting/payroll trên desktop và điện thoại | BROWSER | PASS | 2259 |
| SCREEN-003 | Mở /accounting/payslips trên desktop và điện thoại | BROWSER | PASS | 2917 |
| SCREEN-004 | Mở /accounting/salaries trên desktop và điện thoại | BROWSER | PASS | 12902 |
| SCREEN-005 | Mở /accounting/salary-history trên desktop và điện thoại | BROWSER | PASS | 3351 |
| SCREEN-006 | Mở /applications trên desktop và điện thoại | BROWSER | PASS | 1799 |
| SCREEN-007 | Mở /approvals trên desktop và điện thoại | BROWSER | PASS | 7678 |
| SCREEN-008 | Mở /approvals/completed trên desktop và điện thoại | BROWSER | PASS | 3412 |
| SCREEN-009 | Mở /approvals/delegated trên desktop và điện thoại | BROWSER | PASS | 2994 |
| SCREEN-010 | Mở /approvals/leave trên desktop và điện thoại | BROWSER | PASS | 2767 |
| SCREEN-011 | Mở /approvals/pending trên desktop và điện thoại | BROWSER | PASS | 2658 |
| SCREEN-012 | Mở /attendance trên desktop và điện thoại | BROWSER | PASS | 4096 |
| SCREEN-013 | Mở /attendance/history trên desktop và điện thoại | BROWSER | PASS | 2834 |
| SCREEN-014 | Mở /attendance/logs trên desktop và điện thoại | BROWSER | PASS | 3970 |
| SCREEN-015 | Mở /attendance/me trên desktop và điện thoại | BROWSER | PASS | 3855 |
| SCREEN-016 | Mở /attendance/notifications trên desktop và điện thoại | BROWSER | PASS | 3431 |
| SCREEN-017 | Mở /attendance/quick trên desktop và điện thoại | BROWSER | PASS | 3486 |
| SCREEN-018 | Mở /attendance/records trên desktop và điện thoại | BROWSER | PASS | 7897 |
| SCREEN-019 | Mở /attendance/requests trên desktop và điện thoại | BROWSER | PASS | 4006 |
| SCREEN-020 | Mở /attendance/today trên desktop và điện thoại | BROWSER | PASS | 3308 |
| SCREEN-021 | Mở /command trên desktop và điện thoại | BROWSER | PASS | 4211 |
| SCREEN-022 | Mở /dashboard trên desktop và điện thoại | BROWSER | PASS | 7908 |
| SCREEN-023 | Mở /dashboard/hr trên desktop và điện thoại | BROWSER | PASS | 5372 |
| SCREEN-024 | Mở /dashboard/import-export trên desktop và điện thoại | BROWSER | PASS | 4132 |
| SCREEN-025 | Mở /dashboard/management trên desktop và điện thoại | BROWSER | PASS | 5379 |
| SCREEN-026 | Mở /dashboard/warehouse trên desktop và điện thoại | BROWSER | PASS | 4679 |
| SCREEN-027 | Mở /documents trên desktop và điện thoại | BROWSER | PASS | 4323 |
| SCREEN-028 | Mở /documents/recent trên desktop và điện thoại | BROWSER | PASS | 3581 |
| SCREEN-029 | Mở /documents/shared trên desktop và điện thoại | BROWSER | PASS | 2878 |
| SCREEN-030 | Mở /employees trên desktop và điện thoại | BROWSER | PASS | 2123 |
| SCREEN-031 | Mở /employees/contracts trên desktop và điện thoại | BROWSER | PASS | 9159 |
| SCREEN-032 | Mở /employees/departments trên desktop và điện thoại | BROWSER | PASS | 2888 |
| SCREEN-033 | Mở /employees/insurance trên desktop và điện thoại | BROWSER | PASS | 2905 |
| SCREEN-034 | Mở /employees/new trên desktop và điện thoại | BROWSER | PASS | 2091 |
| SCREEN-035 | Mở /employees/positions trên desktop và điện thoại | BROWSER | PASS | 2772 |
| SCREEN-036 | Mở /home trên desktop và điện thoại | BROWSER | PASS | 8845 |
| SCREEN-037 | Mở /import-export trên desktop và điện thoại | BROWSER | PASS | 4225 |
| SCREEN-038 | Mở /import-export/contracts trên desktop và điện thoại | BROWSER | PASS | 2540 |
| SCREEN-039 | Mở /import-export/contracts/new trên desktop và điện thoại | BROWSER | PASS | 2840 |
| SCREEN-040 | Mở /import-export/customs trên desktop và điện thoại | BROWSER | PASS | 2937 |
| SCREEN-041 | Mở /import-export/documents trên desktop và điện thoại | BROWSER | PASS | 3237 |
| SCREEN-042 | Mở /import-export/partners trên desktop và điện thoại | BROWSER | PASS | 3292 |
| SCREEN-043 | Mở /import-export/shipments trên desktop và điện thoại | BROWSER | PASS | 3440 |
| SCREEN-044 | Mở /import-export/shipments/new trên desktop và điện thoại | BROWSER | PASS | 3046 |
| SCREEN-045 | Mở /import-export/transport trên desktop và điện thoại | BROWSER | PASS | 3107 |
| SCREEN-046 | Mở /leave trên desktop và điện thoại | BROWSER | PASS | 3528 |
| SCREEN-047 | Mở /leave/adjustments trên desktop và điện thoại | BROWSER | PASS | 5214 |
| SCREEN-048 | Mở /leave/balance trên desktop và điện thoại | BROWSER | PASS | 3731 |
| SCREEN-049 | Mở /leave/balances trên desktop và điện thoại | BROWSER | PASS | 3167 |
| SCREEN-050 | Mở /leave/manage trên desktop và điện thoại | BROWSER | PASS | 3346 |
| SCREEN-051 | Mở /leave/manage/adjustments trên desktop và điện thoại | BROWSER | PASS | 2962 |
| SCREEN-052 | Mở /leave/manage/balances trên desktop và điện thoại | BROWSER | PASS | 3027 |
| SCREEN-053 | Mở /leave/my-requests trên desktop và điện thoại | BROWSER | PASS | 3281 |
| SCREEN-054 | Mở /leave/new trên desktop và điện thoại | BROWSER | PASS | 5562 |
| SCREEN-055 | Mở /leave/settlements trên desktop và điện thoại | BROWSER | PASS | 2960 |
| SCREEN-056 | Mở /messages trên desktop và điện thoại | BROWSER | PASS | 2433 |
| SCREEN-057 | Mở /notifications trên desktop và điện thoại | BROWSER | PASS | 2912 |
| SCREEN-058 | Mở /notifications/unread trên desktop và điện thoại | BROWSER | PASS | 2868 |
| SCREEN-059 | Mở /personal trên desktop và điện thoại | BROWSER | PASS | 7981 |
| SCREEN-060 | Mở /personal/payslips trên desktop và điện thoại | BROWSER | PASS | 3503 |
| SCREEN-061 | Mở /profile trên desktop và điện thoại | BROWSER | PASS | 1971 |
| SCREEN-062 | Mở /project-monitoring trên desktop và điện thoại | BROWSER | PASS | 2173 |
| SCREEN-063 | Mở /project-monitoring/issues trên desktop và điện thoại | BROWSER | PASS | 1795 |
| SCREEN-064 | Mở /project-monitoring/recent trên desktop và điện thoại | BROWSER | PASS | 5821 |
| SCREEN-065 | Mở /projects trên desktop và điện thoại | BROWSER | PASS | 2573 |
| SCREEN-066 | Mở /projects/new trên desktop và điện thoại | BROWSER | PASS | 1864 |
| SCREEN-067 | Mở /projects/updates trên desktop và điện thoại | BROWSER | PASS | 2587 |
| SCREEN-068 | Mở /reports trên desktop và điện thoại | BROWSER | PASS | 2554 |
| SCREEN-069 | Mở /search trên desktop và điện thoại | BROWSER | PASS | 2673 |
| SCREEN-070 | Mở /search/results trên desktop và điện thoại | BROWSER | PASS | 2732 |
| SCREEN-071 | Mở /settings trên desktop và điện thoại | BROWSER | PASS | 1875 |
| SCREEN-072 | Mở /settings/approval-delegations trên desktop và điện thoại | BROWSER | PASS | 2916 |
| SCREEN-073 | Mở /settings/approval-workflows trên desktop và điện thoại | BROWSER | PASS | 2902 |
| SCREEN-074 | Mở /settings/attendance trên desktop và điện thoại | BROWSER | PASS | 2647 |
| SCREEN-075 | Mở /settings/attendance/calendar trên desktop và điện thoại | BROWSER | PASS | 2353 |
| SCREEN-076 | Mở /settings/attendance/locations trên desktop và điện thoại | BROWSER | PASS | 2485 |
| SCREEN-077 | Mở /settings/attendance/policies trên desktop và điện thoại | BROWSER | PASS | 2767 |
| SCREEN-078 | Mở /settings/attendance/shifts trên desktop và điện thoại | BROWSER | PASS | 4188 |
| SCREEN-079 | Mở /settings/audit-log trên desktop và điện thoại | BROWSER | PASS | 4598 |
| SCREEN-080 | Mở /settings/export-templates trên desktop và điện thoại | BROWSER | PASS | 23939 |
| SCREEN-081 | Mở /settings/import-export trên desktop và điện thoại | BROWSER | PASS | 8655 |
| SCREEN-082 | Mở /settings/integrations trên desktop và điện thoại | BROWSER | PASS | 4876 |
| SCREEN-083 | Mở /settings/integrations/api-docs trên desktop và điện thoại | BROWSER | PASS | 1875 |
| SCREEN-084 | Mở /settings/integrations/api-keys trên desktop và điện thoại | BROWSER | PASS | 3174 |
| SCREEN-085 | Mở /settings/integrations/attendance-devices trên desktop và điện thoại | BROWSER | PASS | 4276 |
| SCREEN-086 | Mở /settings/integrations/conflicts trên desktop và điện thoại | BROWSER | PASS | 3265 |
| SCREEN-087 | Mở /settings/integrations/imports trên desktop và điện thoại | BROWSER | PASS | 2782 |
| SCREEN-088 | Mở /settings/integrations/service-accounts trên desktop và điện thoại | BROWSER | PASS | 2482 |
| SCREEN-089 | Mở /settings/integrations/webhook-deliveries trên desktop và điện thoại | BROWSER | PASS | 2662 |
| SCREEN-090 | Mở /settings/integrations/webhooks trên desktop và điện thoại | BROWSER | PASS | 4947 |
| SCREEN-091 | Mở /settings/leave trên desktop và điện thoại | BROWSER | PASS | 2567 |
| SCREEN-092 | Mở /settings/leave/policies trên desktop và điện thoại | BROWSER | PASS | 5300 |
| SCREEN-093 | Mở /settings/leave/types trên desktop và điện thoại | BROWSER | PASS | 17904 |
| SCREEN-094 | Mở /settings/leave/workflows trên desktop và điện thoại | BROWSER | PASS | 5232 |
| SCREEN-095 | Mở /settings/notifications trên desktop và điện thoại | BROWSER | PASS | 3776 |
| SCREEN-096 | Mở /settings/organization trên desktop và điện thoại | BROWSER | PASS | 3600 |
| SCREEN-097 | Mở /settings/permissions trên desktop và điện thoại | BROWSER | PASS | 3401 |
| SCREEN-098 | Mở /settings/roles trên desktop và điện thoại | BROWSER | PASS | 2276 |
| SCREEN-099 | Mở /settings/users trên desktop và điện thoại | BROWSER | PASS | 4055 |
| SCREEN-100 | Mở /settings/warehouse trên desktop và điện thoại | BROWSER | PASS | 2882 |
| SCREEN-101 | Mở /shifts trên desktop và điện thoại | BROWSER | PASS | 2214 |
| SCREEN-102 | Mở /shifts/calendar trên desktop và điện thoại | BROWSER | PASS | 2427 |
| SCREEN-103 | Mở /system-admin trên desktop và điện thoại | BROWSER | PASS | 2982 |
| SCREEN-104 | Mở /system-admin/appearance trên desktop và điện thoại | BROWSER | PASS | 1720 |
| SCREEN-105 | Mở /system-admin/attendance-checklist trên desktop và điện thoại | BROWSER | PASS | 4353 |
| SCREEN-106 | Mở /system-admin/audit trên desktop và điện thoại | BROWSER | FAIL | 37337 |
| SCREEN-107 | Mở /system-admin/branding trên desktop và điện thoại | BROWSER | PASS | 25175 |
| SCREEN-108 | Mở /system-admin/config-history trên desktop và điện thoại | BROWSER | PASS | 8702 |
| SCREEN-109 | Mở /system-admin/dashboard trên desktop và điện thoại | BROWSER | PASS | 2659 |
| SCREEN-110 | Mở /system-admin/localization trên desktop và điện thoại | BROWSER | PASS | 8023 |
| SCREEN-111 | Mở /system-admin/modules trên desktop và điện thoại | BROWSER | PASS | 1881 |
| SCREEN-112 | Mở /system-admin/navigation trên desktop và điện thoại | BROWSER | PASS | 1718 |
| SCREEN-113 | Mở /system-admin/notices trên desktop và điện thoại | BROWSER | PASS | 3839 |
| SCREEN-114 | Mở /system-admin/operations trên desktop và điện thoại | BROWSER | PASS | 3760 |
| SCREEN-115 | Mở /system-admin/organization trên desktop và điện thoại | BROWSER | PASS | 2056 |
| SCREEN-116 | Mở /system-admin/payslip-template trên desktop và điện thoại | BROWSER | PASS | 2631 |
| SCREEN-117 | Mở /system-admin/security trên desktop và điện thoại | BROWSER | PASS | 1643 |
| SCREEN-118 | Mở /timesheets trên desktop và điện thoại | BROWSER | PASS | 1692 |
| SCREEN-119 | Mở /timesheets/adjustments trên desktop và điện thoại | BROWSER | PASS | 4094 |
| SCREEN-120 | Mở /timesheets/exceptions trên desktop và điện thoại | BROWSER | PASS | 2772 |
| SCREEN-121 | Mở /timesheets/matrix trên desktop và điện thoại | BROWSER | PASS | 3253 |
| SCREEN-122 | Mở /warehouse trên desktop và điện thoại | BROWSER | PASS | 13048 |
| SCREEN-123 | Mở /warehouse/adjustments trên desktop và điện thoại | BROWSER | PASS | 11002 |
| SCREEN-124 | Mở /warehouse/adjustments/new trên desktop và điện thoại | BROWSER | PASS | 4195 |
| SCREEN-125 | Mở /warehouse/inventory trên desktop và điện thoại | BROWSER | PASS | 6083 |
| SCREEN-126 | Mở /warehouse/issues trên desktop và điện thoại | BROWSER | PASS | 5286 |
| SCREEN-127 | Mở /warehouse/issues/new trên desktop và điện thoại | BROWSER | PASS | 4892 |
| SCREEN-128 | Mở /warehouse/items trên desktop và điện thoại | BROWSER | PASS | 2587 |
| SCREEN-129 | Mở /warehouse/items/new trên desktop và điện thoại | BROWSER | PASS | 3234 |
| SCREEN-130 | Mở /warehouse/ledger trên desktop và điện thoại | BROWSER | PASS | 3762 |
| SCREEN-131 | Mở /warehouse/receipts trên desktop và điện thoại | BROWSER | PASS | 3555 |
| SCREEN-132 | Mở /warehouse/receipts/new trên desktop và điện thoại | BROWSER | PASS | 3344 |
| SCREEN-133 | Mở /warehouse/stock-counts trên desktop và điện thoại | BROWSER | PASS | 3635 |
| SCREEN-134 | Mở /warehouse/stock-counts/new trên desktop và điện thoại | BROWSER | PASS | 5183 |
| SCREEN-135 | Mở /warehouse/transfers trên desktop và điện thoại | BROWSER | PASS | 3359 |
| SCREEN-136 | Mở /warehouse/transfers/new trên desktop và điện thoại | BROWSER | PASS | 11651 |
| SCREEN-137 | Mở /warehouse/warehouses trên desktop và điện thoại | BROWSER | PASS | 3197 |
| SCREEN-138 | Mở /warehouse/warehouses/new trên desktop và điện thoại | BROWSER | PASS | 2996 |
| SCREEN-139 | Mở /worker-attendance trên desktop và điện thoại | BROWSER | PASS | 3187 |
| SCREEN-140 | Mở /worker-attendance/today trên desktop và điện thoại | BROWSER | PASS | 11798 |
| SCREEN-141 | Mở /workspace trên desktop và điện thoại | BROWSER | PASS | 8964 |
| SHELL-360 | Khung cấu hình 360px và một viền focus | BROWSER | PASS | 1532 |
| SHELL-390 | Khung cấu hình 390px và một viền focus | BROWSER | PASS | 1197 |
| SHELL-430 | Khung cấu hình 430px và một viền focus | BROWSER | PASS | 1349 |
| SHELL-1366 | Khung cấu hình 1366px và một viền focus | BROWSER | PASS | 1603 |
| SHELL-1440 | Khung cấu hình 1440px và một viền focus | BROWSER | PASS | 1545 |
| SHELL-1920 | Khung cấu hình 1920px và một viền focus | BROWSER | PASS | 1622 |
| UI-PERSONAL | Nhân viên chỉ thấy Cá nhân và mở phiếu lương từ Cá nhân | BROWSER | PASS | 3552 |
| UI-PAYROLL | Bảng lương lên cao và thao tác có thể chạm trên điện thoại | BROWSER | FAIL | 2299 |
| UI-HR-CREATE | Nhân sự tạo hồ sơ bằng form trình duyệt và mở hồ sơ vừa tạo | BROWSER | PASS | 3515 |
| UI-AUTH | Đăng nhập bằng form, đăng xuất và không dùng lại phiên được | BROWSER | PASS | 3315 |
| SEAL | Khóa tài khoản E2E, giữ chứng từ và audit trên database test | SETUP | PASS | 2760 |

## SCREEN-106

```text
page.waitForFunction: Timeout 29911ms exceeded.
    at Object.ready (C:\Users\Admin\CT_NoiBo\scripts\e2e\page-ready.mjs:62:22)
    at async screen (C:\Users\Admin\CT_NoiBo\scripts\e2e\browser.mjs:25:7)
    at async Object.fn (C:\Users\Admin\CT_NoiBo\scripts\e2e\browser.mjs:45:22)
    at async execute (C:\Users\Admin\CT_NoiBo\scripts\e2e\run.mjs:76:9)
    at async file:///C:/Users/Admin/CT_NoiBo/scripts/e2e/run.mjs:109:124
```

## UI-PAYROLL

```text
AssertionError [ERR_ASSERTION]: Bảng bị đẩy xuống 408.625px
    at Object.fn (file:///C:/Users/Admin/CT_NoiBo/scripts/e2e/browser.mjs:93:7)
    at async execute (file:///C:/Users/Admin/CT_NoiBo/scripts/e2e/run.mjs:76:9)
    at async file:///C:/Users/Admin/CT_NoiBo/scripts/e2e/run.mjs:109:124
```
