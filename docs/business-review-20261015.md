# Rà soát nghiệp vụ và giao diện — 15/10/2026

## Đã hoàn thiện trong bản test này

| Phần | Thay đổi và kiểm tra |
| --- | --- |
| Phép cuối năm | Quy thành lương theo đơn giá Nhân sự nhập. Trang đơn giá/nhân viên/loại phép/năm; số tiền riêng trong bảng lương, phiếu, PDF, Excel. Job tự động đã bật. Có kiểm tra SQL rollback về tính lại, chạy lặp và khóa dữ liệu đã quyết toán. |
| Điểm danh công trường | Lưu nháp, chốt ngày và điều chỉnh ghi trạng thái, danh sách và lịch sử cùng transaction. Kiểm tra quyền, version và lỗi cưỡng bức giữa giao dịch. |
| XNK | Sửa shipment và các dòng cùng transaction; chặn thay danh tính mặt hàng/đơn vị theo vị trí dòng; thay lượng đã nhận phải có lý do. |
| BHXH | Hồ sơ và lịch sử cùng transaction; chặn ghi đè phiên bản cũ. UI xem lịch sử theo nhân viên/kỳ, mức đóng, trạng thái, người đổi, lý do và tài liệu. |
| Hợp đồng | Tạo thủ công khi chưa có mẫu Word, sửa metadata, thay PDF và lưu trữ có version. Khắc phục tình huống phản hồi mạng thất lạc làm xóa PDF đã liên kết thành công. |
| Tài khoản và hồ sơ lương | Chặn gửi lặp, phục hồi lỗi kết nối/clipboard, tải lại dữ liệu khi lỗi. |
| Dữ liệu kế toán lớn | Đọc theo trang cho hồ sơ lương, tổng và dòng bảng lương, phiếu lương; test hơn 1.000 dòng. |
| UI | Sửa lệch hydration của đồng hồ chấm công, nhãn trang chi tiết lương, màu chữ nút BHXH. Quyết toán dùng bảng có lọc và phân trang trên desktop, thẻ trên mobile. |

## Bằng chứng

- **800 test đạt, 0 thất bại, 37 live GET audit opt-in chưa chạy trong Vitest**; tổng 837. `.tmp/full-verification-20261015.json`.
- TypeScript toàn workspace và ESLint các file sửa đạt.
- SQL thật trên database TEST, toàn bộ fixture rollback: **29 kiểm tra công trường/XNK, 16 BHXH và các tình huống quyết toán phép**. Không sử dụng mock để thay thế kết luận transaction.
- Migration 002/003/004 áp dụng vào TEST, tổng 49 migration, lịch `ct-leave-year-end-cashout` active. Job khởi tạo thêm **0** khoản quyết toán thực; dữ liệu test hiện chỉ có năm 2026.
- Audit browser trước bản cập nhật: 33 trang ở 390/1440px cùng form/cửa sổ chi tiết. Bằng chứng giữ tại `docs/ui-evidence/whole-system-20261014/`; lỗi đồng hồ phát hiện ở bản đó đã được sửa, có test SSR/hydration riêng.
- Sau deploy `dpl_CKA5WcXq8JTzB8ihJYF9EUTuvoHT`: **81 trạng thái của 35 trang/cửa sổ/quyền truy cập**, cộng **4 trạng thái quyết toán/nhập đơn giá** ở 390/1440px; 0 lỗi bố cục, 0 lỗi JavaScript, 0 API ghi nghiệp vụ. 77 phản hồi 404 đều thuộc avatar chưa có ảnh và hiển thị fallback đúng; không có API nghiệp vụ thất bại. Phiên admin/employee test đăng xuất 200.
- Biên nhận: [business-deployment-20261015.json](operations/business-deployment-20261015.json). Browser mới: `docs/ui-evidence/whole-system-20261015/report.json`, `docs/ui-evidence/leave-cashout-20261015/report.json`.

## Những phần chưa thể kết luận hoàn chỉnh

| Phần còn lại | Trạng thái |
| --- | --- |
| Thuế, BHXH, OT, thay lương giữa kỳ | Chưa có bộ máy tự động tính đầy đủ. Khấu trừ và các khoản bổ sung vẫn theo dữ liệu đầu vào; cần chính sách công thức cụ thể của doanh nghiệp. |
| Giao phiếu lương qua chat/thông báo | Phiếu và snapshot được phát hành; luồng retry/outbox/biên nhận giao chat và notification chưa hoàn chỉnh. Không đồng nghĩa đã chuyển tiền. |
| Mẫu Excel | Kiểm tra định dạng XLSX đạt; lưu mẫu và version chưa cùng transaction, còn cần bổ sung fault injection và UAT tải từng mẫu qua storage thật. |
| Các module khác | Test và màn hình chỉ xác nhận phạm vi được kiểm tra. Chưa có UAT giao dịch hoàn chỉnh cho mọi role, RLS, thiết bị camera/GPS hoặc nghiệp vụ thực tế của kho/dự án/tích hợp. |
| Quyết toán ngoại lệ | Kỳ tháng 12 đã khóa cần mở lại; đơn giá/số dư đã quyết toán không tự sửa ngược. Thanh toán phép khi nhân viên nghỉ việc giữa năm và điều chỉnh sau quyết toán cần quy trình riêng. |

Chi tiết HR và bằng chứng lịch sử tại [báo cáo HR/UI](business-ui-completion-audit-20261014.md). Cách vận hành tại [quyết toán phép dư](leave-year-end-cashout-20261015.md).
