# Nghỉ phép — dữ liệu và quy trình ngày 14/10/2026

## Nghiệp vụ được giữ

Nhân viên lưu nháp → gửi duyệt → người được giao xử lý bước hiện tại → bước tiếp theo → duyệt cuối cùng mới ghi giảm phép. Từ chối cần lý do. Thu hồi chỉ áp dụng cho đơn của mình đang chờ duyệt khi chính sách cho phép. Hủy đơn đã duyệt hoàn đúng giao dịch đã trừ; khi chính sách yêu cầu HR, người có quyền duyệt toàn bộ phải xử lý.

Nguồn số dư là ledger, không phải một trường số dư sửa trực tiếp. Không tự cấp phép theo luật hoặc tự suy ra ngày phép của từng nhân viên.

## Chẩn đoán ảnh người dùng

Trang cũ hiển thị tích nhân viên × loại nghỉ đang hoạt động và trừ phép. Những loại `[E2E] Phép năm` trùng tên có ID/mã riêng, do dữ liệu kiểm thử tích lũy. Đây không phải cùng một ledger bị nhân bản khi tính. Không gộp theo tên, không xóa dữ liệu và không ẩn loại đang hoạt động.

API vẫn trả một số dư cho từng `employeeId + leaveTypeId + year`. `leaveTypeCode` giúp phân biệt loại cùng tên. Những loại ngừng dùng có ledger hoặc lịch sử nghỉ liên quan trong năm được giữ trong dữ liệu số dư. Người đang ở trạng thái `on_leave` vẫn nằm trong nhân sự được theo dõi/cấp/điều chỉnh phép.

## Thay đổi server

- Danh sách đơn đọc từng trang 500 dòng, bỏ giới hạn cứng 300. Bộ lọc ngày lấy đơn giao với khoảng ngày, gồm cả hai đầu. `scope=team` dùng nhân viên báo cáo trực tiếp và bản thân; `scope=all` vẫn kiểm tra quyền toàn công ty.
- Inbox riêng của người duyệt chỉ có bước pending đầu tiên được giao cho họ; người ở bước sau chưa được phép xử lý trước. Người có `leave.approve_all` có thể xử lý bước chưa xác định người duyệt.
- Chi tiết trả `availableActions`, tính bằng chủ đơn, quyền, trạng thái, chính sách và bước hiện tại; không suy ra quyền từ kích thước màn hình.
- `used` là số ngày đã trừ sau khi hoàn phép. Hủy đơn không tiếp tục làm tăng chỉ số đã dùng.
- Đơn nháp sửa lại kiểm tra số dư, lịch trùng và cảnh báo dự án. Lỗi đọc lịch/phân công/ledger được trả thành lỗi, không giả thành dữ liệu trống.
- Lý do chỉ bắt buộc khi loại nghỉ yêu cầu. Giữ giới hạn 3.000 ký tự; loại không yêu cầu lý do có thể lưu chuỗi rỗng.
- Đơn mới lưu lịch ngày làm việc trong `request_snapshot.calendarSnapshot`; API trả `workingDates`. Khi gửi duyệt, SQL xác nhận số ngày theo lịch đang áp dụng và chụp lại lịch thực tế. Bản ghi cũ không có snapshot vẫn trả `workingDates=undefined`, không tự tạo lịch quá khứ theo cấu hình hiện tại.
- `GET /api/v1/leave-workflows/approvers`: ứng viên active có quyền duyệt nghỉ và các vai trò duyệt, chỉ cho người quản lý quy trình. `GET /api/v1/leave-balances/employees`: danh sách nhân viên theo quyền điều chỉnh phép, không đòi thêm quyền xem phân hệ nhân sự.

## Migration cần áp dụng trước bản code này

`supabase/migrations/202610140001_leave_workflow_integrity.sql` tạo các command dùng transaction:

| Command | Tác động |
| --- | --- |
| `save_leave_workflow_command` | Lưu cấu hình legacy và phát hành cùng ID trên nền tảng duyệt chung; phiên bản cũ được giữ, không sửa bước đã chụp trong đơn |
| `submit_leave_request_command` | Kiểm tra phiên bản/chủ đơn/lịch/quy trình hiện hành, tạo toàn bộ bước và chuyển trạng thái trong một transaction |
| `process_leave_approval_command` | Khóa đơn, kiểm tra phiên bản và ID bước; xử lý quyền toàn bộ hoặc ủy quyền trong transaction; cập nhật từng bước và ledger |
| `withdraw_leave_request_command` | Thu hồi và hủy những bước pending trong cùng transaction |
| `cancel_approved_leave_command` | Hoàn những ledger thực sự đã trừ, độc lập với loại nghỉ hiện đã đổi tên hoặc ngừng dùng |
| `post_leave_ledger_command` | Cấp/điều chỉnh phép, kiểm tra chứng từ replay, nhân sự/loại/năm; khóa nhân viên cùng thứ tự trong batch |

Các command chỉ cho `service_role`; server routes vẫn kiểm tra người dùng. Cấp, trừ, gửi và duyệt dùng cùng advisory lock theo nhân viên. Trừ điều chỉnh bảo vệ phần phép đang chờ duyệt khi chính sách không cho âm phép. Ngày hiệu lực điều chỉnh phải thuộc năm phép, số lượng tối đa hai chữ số thập phân.

Lưu quy trình có phiên bản mong đợi sẽ từ chối bản chỉnh sửa cũ. Quy trình mirrored được đọc từ phiên bản published trên nền tảng chung, vì submit đã ưu tiên nguồn này từ trước. Tắt/sửa quy trình tác động đơn gửi sau đó; các snapshot cũ không đổi.

RPC duyệt/hủy kiểm tra kỳ công đã khóa có dữ liệu của đúng nhân viên trong `daily_timesheets` hoặc `timesheet_period_summaries`. Nếu có, command bị chặn và yêu cầu mở kỳ công theo luồng hiện có; không sửa snapshot đã khóa. Các kỳ không chứa nhân viên không chặn họ.

## Giới hạn được ghi rõ

- Đơn trừ phép qua hai năm phải tách thành hai đơn. Không tự phân bổ theo năm khi chưa có quy tắc nghiệp vụ được xác nhận, không viết lại ledger quá khứ.
- Kiểm tra lịch trùng vẫn theo khoảng ngày; chưa nhận hai đơn sáng/chiều khác nhau cùng ngày vì nguồn tổng hợp công hiện lấy một đơn trong ngày.
- Cờ và mức chuyển phép được lưu trong chính sách hiện có, nhưng chưa có batch tự chuyển phép/expiry. Không báo rằng hệ thống đã tự chuyển số dư.
- Sau thay đổi nghỉ đã duyệt trong kỳ công đang mở, HR vẫn chạy tính lại công trước khi rà soát/chốt kỳ. Không tự tính lại hoặc phát hành lương từ thao tác duyệt nghỉ.
- Báo cáo không tuyên bố đã chạy UAT/concurrency. Agent thực hiện không thêm hoặc chạy test, không áp migration và không ghi dữ liệu ngoài workspace. Root thực hiện kiểm tra, migration và deploy khi bàn giao.

## Phạm vi file

`leaveRepository.ts`, `leaveRules.ts`, `leaveTypes.ts`, `leaveSchemas.ts`; routes danh sách, duyệt/từ chối/hủy và hai endpoint picker; nhánh LEAVE trong `shared-platforms/services/approvalRepository.ts`; migration nêu trên. Các màn UI do agent khác/root triển khai.

Rollback code yêu cầu trả về bản dùng RPC cũ trước khi loại bỏ migration. Không xóa ledger hoặc workflow versions để rollback; RPC cũ vẫn được giữ làm wrapper tương thích.
