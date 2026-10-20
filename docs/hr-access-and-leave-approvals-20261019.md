# Nhân sự và phê duyệt nghỉ phép — 19/10/2026

## Phạm vi quyền

- Vai trò Nhân sự quản lý hồ sơ, công, nghỉ phép và vòng đời tài khoản nhân viên. Không có quyền gán nhóm quyền, đọc toàn bộ nhóm quyền hay nhật ký quản trị hệ thống.
- Các quyền `account.create`, `account.view`, `account.disable` tiếp tục phục vụ hồ sơ nhân viên.
- `attendance.config.view` không còn làm hiện ứng dụng Quản trị; cấu hình chấm công thuộc ứng dụng Nhân sự.
- Thanh điều hướng cấu hình lọc từng liên kết theo quyền thực; tổ chức và nhật ký quản trị còn yêu cầu `system_admin.access` như trang đích.
- Trang `/settings/roles` và API vai trò tiếp tục kiểm tra `role.view` ở server. Bản sửa TEST thu hồi quyền này khỏi vai trò `hr`.

## Duyệt nghỉ phép

- Dùng cùng một danh mục quyền cho ứng dụng, điều hướng, layout, dashboard và API hộp duyệt.
- Người chỉ có `leave.approve` hoặc `leave.approve_all` thấy các hồ sơ LEAVE được giao; không được xem danh sách phê duyệt kho/XNK qua quyền nghỉ phép.
- Quyết định LEAVE chấp nhận quyền nghỉ phép trên bước hiện tại được giao đúng tài khoản; giữ nguyên kiểm tra phiên bản, bước duyệt, kỳ công khóa và số dư phép trong RPC.
- Không cấp `approval.act`, `approval.view_all` hay quyền quản trị rộng cho Nhân sự. Ủy quyền liên nghiệp vụ tiếp tục cần `approval.act` theo RPC hiện có.
- API chi tiết trả `availableActions`; giao diện chỉ hiện nút có quyền thực hiện. Từ chối cần ít nhất 3 ký tự lý do.
- Quản lý nghỉ phép có liên kết `Cần tôi duyệt`. Quy trình hiện có giữ nguyên người nhận; không tự gán các đơn E2E cho `hr.test`.

## Bản sửa dữ liệu TEST đã chuẩn bị

- Tệp: `scripts/testing/repairs/20261019_hr_role_access.sql`.
- SHA-256: `7787665b2eab046322d5627dceb39faf5f80ea9d69cb936529c022481146be51`.
- Đích duy nhất: `lgmlkagcytfjazulgfbz`, tài khoản `hr.test`, vai trò chuẩn `hr` ID `9dbdceb7-7361-4889-b00b-a4c183212d15`.
- Thu hồi đúng 4 quyền: `account.assign_role`, `role.view`, `permission.view`, `audit.view`.
- Vai trò `hr` được các danh tính TEST khác dùng chung; không đổi mã vai trò, định nghĩa vai trò hay liên kết tài khoản để giữ `hr_resolver` hoạt động.
- SQL xác nhận marker TEST, chủ sở hữu bộ test, ID tài khoản/vai trò, quyền nghiệp vụ cần giữ; kiểm tra trong transaction tất cả quyền khác, các định nghĩa vai trò và liên kết tài khoản không đổi.
- Runner đã chuẩn bị: `node .tmp/apply-hr-role-access-20261019.mjs`. Runner còn xác nhận dự án qua provider, hash SQL, checksum dữ liệu nghiệp vụ trước/sau, 54 bản ghi migration và liên kết CLI production không đổi. Receipt ghi vào `docs/operations/hr-role-access-repair-20261019.json` khi áp dụng.
- `testAccounts.json` và bộ seed ghi rõ 4 quyền bị loại để lần seed TEST được yêu cầu sau này không khôi phục quyền thừa. Không chạy reseed để áp dụng thay đổi này.

## Kiểm tra source

- TypeScript `tsc --noEmit` và ESLint các tệp sửa.
- Đọc cấu hình TEST để chẩn đoán; không gửi quyết định duyệt, không chạy bộ test, không ghi dữ liệu nghiệp vụ trong công việc source này.
