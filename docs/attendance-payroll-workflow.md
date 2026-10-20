# Công và lương — cập nhật 12/10/2026

## Nghiệp vụ

1. Thu thập công từ tự chấm vào/ra, điểm danh công trường đã gửi, đơn nghỉ đã duyệt, ca và lịch làm việc.
2. Tổng hợp kỳ công; đối chiếu bản ghi ngày với tổng công. Các nguồn lớn được đọc theo trang, tránh mất dữ liệu ở giới hạn 1.000 bản ghi.
3. Nhân sự bổ sung/sửa giờ vào/ra, trạng thái, ngày công hoặc ghi nhận lý do. Nguồn chấm công gốc vẫn được giữ trong snapshot. Giờ hiệu lực đã sửa được đưa vào phép tính số phút và ngày công.
4. Xử lý ngoại lệ có kết quả/lý do. Kỳ công đã khóa không cho xử lý ngoại lệ hoặc ghi điều chỉnh.
5. Chốt kỳ: chặn kỳ rỗng, thiếu chi tiết ngày, lệch tổng công và ngoại lệ nghiêm trọng đang mở. Lưu snapshot phiên bản kỳ công.
6. Kế toán lập bảng lương từ kỳ công đã chốt. Đối chiếu hồ sơ lương hiệu lực, công chuẩn, công thực tế, phiên bản nguồn; tính và lưu căn cứ trên từng dòng.
7. Kiểm tra → khóa → gửi phiếu. Sửa dòng đã kiểm tra đưa kỳ về `calculated`, xóa dấu kiểm tra cũ và tăng phiên bản. DB khóa cả kỳ và dòng trong cùng transaction.
8. Nhân viên xem và xác nhận phiếu trong Cá nhân. Xem và xác nhận là hai trạng thái riêng. Xác nhận lặp giữ nguyên lần xác nhận đầu.
9. Mở lại lương có lý do, thu hồi phiếu cũ và giữ lịch sử. Phải mở lại lương đã khóa/phát hành trước khi mở kỳ công liên kết. Công đổi phiên bản hoặc hồ sơ lương thay đổi buộc tính lại trước khi kiểm tra/khóa/gửi.

## Cách tính hiện có

- `actual`: lương thỏa thuận × công thực tế / công chuẩn; giữ cách tính của hệ thống trước thay đổi này.
- `paid_time`: công thực tế + phép năm + phần ngày công tác chưa được tính vào công thực tế. Giới hạn công hưởng lương ở công chuẩn để không tính trùng.
- Phụ cấp, thưởng và khấu trừ lấy từ hồ sơ lương hiệu lực; kế toán có thể điều chỉnh với lý do trước khi khóa.
- Snapshot ghi hồ sơ lương, ngày hiệu lực, lương thỏa thuận, công chuẩn/thực tế/hưởng lương, tỷ lệ, cách tính và phiên bản kỳ công. Mức lương được chọn theo ngày kết thúc kỳ, đúng quy tắc đang dùng trong hệ thống.
- Khấu trừ vẫn là khoản tiền được nhập/đối chiếu; cập nhật này **không triển khai bộ máy tính tự động thuế TNCN, BHXH, lương thay đổi giữa kỳ hoặc tiền tăng ca theo chính sách doanh nghiệp**. Không thể coi các khoản đó đã tự động được tính chỉ vì bảng lương đã có số tổng.

## Giao diện

- Bảng công mặc định Tháng; Tuần là tùy chọn, từ thứ Hai đến Chủ nhật, tuần đầu/cuối có thể thiếu ngày ngoài kỳ.
- Desktop đủ rộng hiển thị toàn tháng trong bảng vừa khung; khung hẹp và điện thoại dùng lịch 7 cột theo nhân viên. Không có thanh cuộn ngang.
- Lọc nhân viên/phòng ban/cần rà soát, phân trang nhân viên. Tổng kỳ giữ nguyên khi lọc hoặc chuyển tuần.
- Bấm ngày để xem ca, giờ vào/ra, phút làm, muộn/sớm, phép, nguồn dữ liệu và điều chỉnh.
- Kỳ công có tổng hợp/chi tiết, tìm nhân viên, chọn ngày, phân trang 50 bản ghi, xuất báo cáo, mở lại có lý do, chuyển sang tính lương theo quyền.
- Chi tiết lương có đối chiếu đầu vào, dự tính cho kỳ nháp, căn cứ từng dòng, tìm nhân viên, điều chỉnh và theo dõi phiếu.
- Không thêm mô tả dưới nhãn chức năng/action/menu.

## Tài liệu ERP tham khảo

Luồng được điều chỉnh theo các chức năng hiện có của CT_NoiBo, tham khảo tài liệu chính thức:

- [MISA: Tổng hợp công, xác nhận công và chuyển tính lương](https://helpamis.misa.vn/amis-cham-cong/kb/tinh-nang-cham-cong-tong-hop/)
- [MISA: Luồng nghiệp vụ tính lương](https://helpamis.misa.vn/amis-tien-luong/kb/huong-dan-chung-luong-nghiep-vu-tinh-luong-tong-quan-tren-amis-tien-luong/)
- [Odoo 19: Work entries và xử lý xung đột](https://www.odoo.com/documentation/19.0/applications/hr/payroll/work_entries.html)
- [Odoo 19: Payslips](https://www.odoo.com/documentation/19.0/applications/hr/payroll/payslips.html)

## Migration và kiểm thử

- `202610120001_attendance_payroll_workflow.sql`: transaction tổng hợp công và tính/điều chỉnh/kiểm tra/khóa lương; dữ liệu căn cứ; bảo vệ nguồn và phụ thuộc kỳ công/lương.
- `202610120002_timesheet_exception_operations.sql`: xử lý ngoại lệ có khóa kỳ, chặn thay đổi kỳ đã chốt.
- `202610120003_payroll_input_validation.sql`: sửa alias SQL trong kiểm tra đầu vào. Giữ migration đã áp dụng để bảo toàn lịch sử/checksum.
- Migration được áp dụng vào **Supabase TEST riêng**. Database khác phải áp dụng đủ migration trước khi dùng code mới.
- Suite E2E có dữ liệu, tài khoản riêng và chỉ phát hành phiếu cho nhân viên thuộc lượt chạy. Sau test, tài khoản bị vô hiệu hóa, chứng từ và audit được giữ lại.

```powershell
$env:E2E_FILTER = 'TIME-,PAY-'
npm run test:e2e:business -- --allow-remote
```

Chỉ chạy với `.env.e2e.local` và ownership guard của TEST. `E2E_FILTER` nhận nhiều tiền tố cách nhau bằng dấu phẩy. Catalog ca test không phải báo cáo đã pass.

## Bằng chứng kiểm thử cuối

- 106 test hồi quy trong 30 file đã đạt (shared controls, điểm danh công nhân, timesheets, accounting và chuyển động).
- 17/17 ca E2E công–lương đã đạt: `test-results/e2e/202610123edad7/report.md`. Bao gồm tài khoản/setup và seal; các ca nghiệp vụ không bị fail hoặc blocked.
- 90 lượt bố cục thuộc 7 vai trò: `test-results/ui-safe-area/report.json`, không có lỗi tràn ngang hoặc sát ngoài khoảng an toàn.
- 20 kiểm tra UI công/lương: `test-results/workflow-ui/report.json`, gồm toàn tháng/tuần ở 320–1920px, drawer 22px, form điều chỉnh, căn cứ lương, chuyển trang thực tế và giảm chuyển động.
- Typecheck, lint phạm vi thay đổi, kiểm tra diff và thứ tự 43 migration đã đạt. Chưa chạy lại toàn bộ 246 ca trong catalog.
- Số ngoại lệ hiển thị được đối chiếu với hàng đợi `open`, không dùng số cờ lỗi nguồn đã được xử lý làm số việc cần xử lý.
