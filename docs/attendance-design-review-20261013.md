# Rà soát giao diện chấm công — 13/10/2026

## Đã chỉnh

- **Chấm công hôm nay:** thẻ giờ/ca làm và nút chấm vào/ra nổi bật; địa điểm, kết nối và lượt chấm được chia rõ. Màn camera, xem lại ảnh và thành công dùng cùng bo góc và khoảng cách.
- **Ca làm cá nhân:** giờ ca, lượt vào/ra, trạng thái và hành động tách riêng; nút chấm hiển thị trên desktop và điện thoại.
- **Lịch sử:** lịch ngày có trạng thái, số liệu tháng, chọn ngày và thẻ chi tiết vào/ra dễ đọc.
- **Nhật ký:** nhận diện nhân viên, giờ/ngày, loại lượt và trạng thái rõ hơn; điện thoại dùng thẻ. Nút xem ảnh thu gọn trên tablet để không bị cắt chữ.
- **Chi tiết lượt công:** metadata chia nhóm, form điều chỉnh và dòng lịch sử riêng; ảnh có cửa sổ cuộn phù hợp màn hình thấp.
- **Kiểm tra công:** 5 thẻ tổng quan, thanh ngày/bộ lọc, danh sách chọn người, giờ làm và ảnh vào/ra có phân cấp rõ.
- **Yêu cầu điều chỉnh:** thẻ responsive, controls đồng bộ; từ chối dùng dialog nhập lý do, có hủy và Escape. Dialog đóng sau khi máy chủ xác nhận, trước khi tải lại danh sách.
- **Cấu hình:** chính sách/ca làm và địa điểm/thêm địa điểm chia thành panel; công tắc rõ trạng thái, nhãn dài xuống dòng trên điện thoại.

Không thêm mô tả nghiệp vụ dưới chức năng. Thay đổi được giới hạn trong component và CSS Module của chấm công; 34 tệp API, client GPS/offline, hook, service, schema/type, auth và CSS chung khớp hash đầu nhiệm vụ.

## Tệp chính

- [AttendanceCameraExperience.tsx](../src/features/attendance/components/AttendanceCameraExperience.tsx) và CSS Module.
- [PersonalToday.tsx](../src/features/attendance/components/PersonalToday.tsx) và CSS Module.
- [AttendanceHistory.tsx](../src/features/attendance/components/AttendanceHistory.tsx) và CSS Module.
- [AttendanceRecords.tsx](../src/features/attendance/components/AttendanceRecords.tsx) và CSS Module.
- [AttendanceRecordDetail.tsx](../src/features/attendance/components/AttendanceRecordDetail.tsx), [AttendanceDetail.module.css](../src/features/attendance/components/AttendanceDetail.module.css).
- [AttendanceEvidence.tsx](../src/features/attendance/components/AttendanceEvidence.tsx) và CSS Module.
- [AttendancePhotoReview.tsx](../src/features/attendance/components/AttendancePhotoReview.tsx) và CSS Module.
- [AttendanceAdjustmentRequests.tsx](../src/features/attendance/components/AttendanceAdjustmentRequests.tsx) và CSS Module.
- [AttendanceSettings.tsx](../src/features/attendance/components/AttendanceSettings.tsx) và CSS Module.

## Kiểm tra

Browser QA dùng component thực với fixture ở 320×640, 390×844, 768×1024, 1024×768 và 1440×900. Kiểm tra các màn chính, chọn ngày, xem ảnh, mở/đóng dialog từ chối, đổi trạng thái công tắc và chụp/xem lại ảnh. Chặn request ghi và không bấm xác nhận ghi nhận công.

Kết quả chi tiết nằm trong [report.json](ui-evidence/attendance-design-20261013/report.json). Fixture development được gỡ sau kiểm tra.

| Kiểm tra | Kết quả |
| --- | --- |
| Bố cục và thao tác | 65 trường hợp đạt trên 5 kích thước; không tràn ngang, cắt chữ nút hoặc vượt khung dialog |
| Camera/GPS mô phỏng | 15 trường hợp đạt; chụp và xem lại ảnh trong phiên trình duyệt riêng cho từng kích thước |
| Trạng thái UI khác nhau | 75 trạng thái sau khi gộp các lượt trùng |
| Test component hiện có | 16 test đạt trong 4 tệp |
| Typecheck và ESLint các component thay đổi | Đạt |
| Production build | Đạt; 282 trang |
| Tệp nguồn được bảo vệ | 34 hash không đổi; không có request ghi dữ liệu |

Build vẫn ghi `system_settings.read_failed` của môi trường cấu hình hiện tại và hoàn thành với mã thoát 0. Đã gỡ cả type cache của route fixture sau khi xóa route.

## Ảnh giao diện

| Màn | Desktop | Điện thoại |
| --- | --- | --- |
| Chấm công hôm nay | [1440 px](ui-evidence/attendance-design-20261013/personal-1440.png) | [390 px](ui-evidence/attendance-design-20261013/personal-390.png) |
| Camera | [1440 px](ui-evidence/attendance-design-20261013/camera-1440.png) | [390 px](ui-evidence/attendance-design-20261013/camera-390.png) |
| Lịch sử | [1440 px](ui-evidence/attendance-design-20261013/history-1440.png) | [390 px](ui-evidence/attendance-design-20261013/history-390.png) |
| Kiểm tra công | [1440 px](ui-evidence/attendance-design-20261013/review-1440.png) | [390 px](ui-evidence/attendance-design-20261013/review-390.png) |

## Giới hạn

Ảnh và browser QA dùng dữ liệu mẫu, camera/GPS mô phỏng; chưa thử phần cứng điện thoại thực hoặc gửi lượt công lên cơ sở dữ liệu. Quy tắc tính công, quyền và cơ chế đồng bộ được giữ nguyên.
