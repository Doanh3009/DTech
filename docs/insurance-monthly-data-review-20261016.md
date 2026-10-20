# BHXH: hồ sơ và quá trình đóng theo tháng — 16/10/2026

## Dữ liệu và luồng

- Mỗi hồ sơ có quá trình đóng riêng trong `employee_insurance_contributions`, duy nhất theo nhân viên và tháng. Các kỳ trước được giữ khi cập nhật kỳ mới.
- Một kỳ lưu mức đóng, tỷ lệ do Nhân sự nhập, tạm tính, số tiền thực đóng, tình trạng, ngày đóng và ghi chú. Số tiền/ngày thực đóng có thể chưa được ghi nhận, kể cả khi dữ liệu cũ có trạng thái Đã đóng.
- `expected_amount` chỉ là `round(contribution_base * contribution_rate_percent / 100)`, theo dữ liệu Nhân sự nhập. Giá trị này không được dùng thay cho số tiền đã thanh toán.
- Ba tình trạng hiện có: `pending`, `paid`, `overdue`. Có số tiền thực đóng dương hoặc ngày đóng thì phải chọn `paid`. Không tự suy ra chậm đóng từ các tháng còn thiếu.
- Kỳ chưa có dữ liệu vẫn chưa có dữ liệu. Không tạo một chuỗi tháng hoặc dùng ngày hiệu lực của hồ sơ làm kỳ đóng.
- Sửa kỳ cũ không làm kỳ hiện tại quay về tháng cũ. Cập nhật một kỳ luôn làm mất hiệu lực phiên bản hồ sơ đang mở để tránh ghi đè dữ liệu mới.

## API và phân quyền

- `GET /api/v1/insurance` bổ sung `records[].contributions`.
- `GET /api/v1/insurance/{employeeId}` trả riêng hồ sơ của nhân viên, bao gồm quá trình đóng.
- `POST /api/v1/insurance/contributions` ghi nhận hoặc sửa một tháng; schema là `insuranceContributionInputSchema`, kiểu dùng chung nằm ở `src/features/insurance/sharedtypes.ts`.
- Xem dữ liệu đóng theo tháng cần `insurance.view`; ghi nhận cần `insurance.edit`. Lịch sử biến động hồ sơ vẫn yêu cầu `insurance.history.view`; tài liệu vẫn yêu cầu quyền tài liệu riêng. Không cấp thêm quyền cho vai trò nào.
- Các bảng có RLS, không mở trực tiếp cho `anon` hoặc `authenticated`. Service chỉ được đọc trực tiếp; ghi qua RPC đã kiểm tra tài khoản đang hoạt động và quyền.
- Các API mới trả `private, no-store`.

## Tính nguyên tử và đồng thời

- `save_insurance_contribution_command` khóa hồ sơ trước, sau đó khóa kỳ đóng. Sửa dữ liệu hiện có phải có `expectedUpdatedAt` đúng; tạo mới không được gửi phiên bản cũ.
- Kỳ đóng, hồ sơ hiện tại, biên nhận lệnh và audit được lưu trong cùng giao dịch. Lỗi audit làm toàn bộ lệnh rollback.
- Biên nhận giúp nhận biết lệnh đã commit khi phản hồi mạng bị mất. Không tự thực hiện một lần ghi thứ hai.
- RPC hồ sơ hiện có được giữ nguyên bên trong wrapper; hàm bên trong bị thu hồi quyền gọi trực tiếp. Tải tài liệu private và lịch sử hồ sơ vẫn hoạt động theo luồng trước đó.
- Form hồ sơ gửi `recordContribution:false`: giữ nguyên tháng và tình trạng thanh toán đã ghi nhận, chỉ cập nhật thông tin hồ sơ/phạm vi bảo hiểm. Form kỳ đóng xử lý thanh toán.
- Client cũ không gửi cờ này vẫn có thể ghi nhận kỳ được chọn cùng hồ sơ trong một giao dịch. Nếu client cũ cố chuyển kỳ có số tiền/ngày thực đóng thành chưa đóng, lệnh báo xung đột và yêu cầu sửa trong Quá trình đóng; không xóa âm thầm dữ liệu thanh toán.

## Chuyển dữ liệu cũ

Migration `202610160001_insurance_monthly_contributions.sql` chỉ nhập các snapshot có tháng hợp lệ và trạng thái được ghi rõ.

- Hồ sơ hiện tại là nguồn xác định cho chính tháng đang được ghi trong hồ sơ.
- Các tháng lịch sử lấy snapshot mới nhất có thể xác định. Nếu hai snapshot mới nhất cùng thời điểm nhưng mâu thuẫn về trạng thái/mức/tỷ lệ, tháng đó chưa được nhập để Nhân sự đối chiếu; không chọn trạng thái bằng thứ tự UUID ngẫu nhiên.
- Không suy ra số tiền/ngày đã đóng từ tạm tính, không sao chép lý do biến động hoặc tài liệu riêng sang dữ liệu xem thông thường.
- Bản test trước thay đổi có 5 hồ sơ, tất cả chưa ghi nhận tháng đóng. Chúng không trở thành 5 hồ sơ nợ/chậm đóng.

## Kiểm tra

- 46 test unit/API đạt trong `.tmp/insurance-data-unit-20261016.json`.
- TypeScript toàn dự án và ESLint phạm vi backend đạt tại thời điểm bàn giao.
- 30 kiểm tra PostgreSQL thực trên database TEST `lgmlkagcytfjazulgfbz` đạt trong giao dịch **ROLLBACK**, gồm dữ liệu cũ, tháng mâu thuẫn, phân quyền, phiên bản, sửa kỳ cũ, biên nhận lệnh, trạng thái/số tiền và lỗi audit. Bộ kiểm tra RPC hồ sơ/tài liệu hiện có cũng chạy trong giao dịch này.
- Báo cáo: `.tmp/insurance-monthly-sql-report-20261016.json`. Sau rollback vẫn 50 migration; bảng mới không tồn tại; số nhân viên/hồ sơ/biến động/audit không đổi; liên kết CLI production không đổi.
- SHA256 migration đã bàn giao: `b6358c2e31015044d881f2aaa63c96893b80ce92f1e54a90ce25a3ab6c837887`.

Tài liệu này ghi nhận kiểm tra nguồn và preflight. Migration/deploy TEST thực tế do agent gốc thực hiện và ghi vào biên bản triển khai riêng.
