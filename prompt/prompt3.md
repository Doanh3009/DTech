# PROMPT 03 — NHÂN SỰ, HỒ SƠ NHÂN VIÊN/CÔNG NHÂN, TÀI KHOẢN VÀ PHÂN QUYỀN

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Các prompt trước đã xác lập:

- kiến trúc nền tảng
- routing chuẩn
- design system
- frontend enterprise
- mobile-first cho hiện trường
- permission-aware UI
- API-first architecture
- configuration over hard-code
- audit foundation

Prompt này triển khai **module Nhân sự** và các nền tảng liên quan đến:

1. Hồ sơ nhân viên.
2. Hồ sơ công nhân.
3. Phân loại nhân sự.
4. Quá trình làm việc.
5. Hồ sơ giấy tờ.
6. Tài khoản đăng nhập.
7. Vai trò và quyền.
8. Vòng đời nhân sự.
9. Phân công quản lý trực tiếp.
10. Audit đối với thay đổi nhạy cảm.

Không triển khai sâu:

- chấm công
- bảng công
- nghỉ phép
- kho
- xuất nhập khẩu
- dự án/công trường
- report engine

Các module đó sẽ có prompt riêng.

---

# 1. NGUYÊN TẮC CỐT LÕI

## 1.1 Employee Record ≠ User Account

Bắt buộc tách:

```text
PERSON / EMPLOYEE RECORD
        ≠
USER ACCOUNT
```

Một nhân sự có thể tồn tại trong hệ thống nhưng chưa có tài khoản đăng nhập.

Ví dụ:

```text
Công nhân thời vụ
Có hồ sơ
Có phân công
Có bảng công
Không có tài khoản
```

Hoặc:

```text
Nhân viên nghỉ việc
Hồ sơ vẫn tồn tại
Tài khoản bị vô hiệu hóa
```

Không xóa hồ sơ lịch sử chỉ vì tài khoản bị khóa.

---

# 2. CÁC LOẠI NHÂN SỰ

Hệ thống phải hỗ trợ ít nhất:

```text
Nhân viên văn phòng
Kỹ sư
Giám sát
Công nhân
Nhân sự thời vụ
Nhân sự nhà thầu phụ
Nhân sự hỗ trợ
```

Không hard-code loại nhân sự vào logic.

Loại nhân sự phải là danh mục cấu hình được trong Admin nếu phù hợp.

---

# 3. HỒ SƠ NHÂN SỰ — NHÓM THÔNG TIN

Mỗi hồ sơ phải tổ chức thành section rõ ràng.

## 3.1 Thông tin cơ bản

Các field tối thiểu:

```text
Mã nhân viên *
Họ và tên *
Tên hiển thị
Ngày sinh
Giới tính
Ảnh đại diện
Số điện thoại *
Email cá nhân
Email công ty
```

Yêu cầu:

- `employee_code` unique
- normalize phone
- validate email nếu có
- họ tên hỗ trợ đầy đủ tiếng Việt
- không dùng tên làm khóa chính
- mã nhân viên phải ổn định

---

## 3.2 CCCD / giấy tờ định danh

Field:

```text
Số CCCD
Ngày cấp
Nơi cấp
Ngày hết hạn nếu có
Ảnh mặt trước
Ảnh mặt sau
```

Yêu cầu bảo mật:

- dữ liệu nhạy cảm
- không hiển thị đầy đủ CCCD cho role không có quyền
- có thể mask ví dụ `********1234`
- ảnh CCCD lưu private storage
- không public URL
- audit khi xem hoặc export dữ liệu nhạy cảm nếu hệ thống đã hỗ trợ audit event cho access
- không log CCCD đầy đủ

Không bắt buộc CCCD ở bước tạo nhân viên nếu HR chưa có đủ dữ liệu.

---

# 4. ĐỊA CHỈ VÀ LIÊN HỆ

Các field:

```text
Địa chỉ hiện tại
Địa chỉ thường trú
Tỉnh/Thành
Phường/Xã nếu cần
Quốc gia
```

Không cần xây GIS phức tạp.

---

# 5. THÔNG TIN CÔNG VIỆC

Field:

```text
Công ty / đơn vị
Phòng ban *
Chức vụ *
Vị trí công việc
Loại nhân sự *
Quản lý trực tiếp
Ngày vào làm *
Ngày thử việc
Ngày chính thức
Ngày nghỉ việc
Trạng thái làm việc *
```

Trạng thái đề xuất:

```text
Chờ nhận việc
Đang thử việc
Đang làm việc
Tạm nghỉ
Nghỉ việc
```

Không hard-code nếu có thể đưa thành domain enum/config rõ ràng.

---

# 6. PHÒNG BAN VÀ CHỨC VỤ

Tách các thực thể:

```text
Department
Position / Job Title
Employment Type
```

Không lưu phòng ban bằng string trực tiếp trong employee nếu database có entity riêng.

Ví dụ:

```text
employee.department_id
employee.position_id
```

Không tạo dữ liệu lặp theo tên.

Admin có thể:

- thêm phòng ban
- sửa tên
- vô hiệu hóa
- sắp xếp
- thiết lập trưởng phòng
- thêm chức vụ
- vô hiệu hóa chức vụ

Không xóa cứng dữ liệu đã được dùng trong lịch sử nếu việc đó phá referential integrity.

---

# 7. HỢP ĐỒNG LAO ĐỘNG

Hỗ trợ nhiều hợp đồng theo thời gian.

Không chỉ lưu:

```text
contract_number
```

trực tiếp trong employee record duy nhất.

Mô hình:

```text
Employment Contract
- employee_id
- contract_number
- contract_type
- start_date
- end_date
- status
- attachment
- note
```

Loại hợp đồng có thể là danh mục cấu hình.

Không cần triển khai payroll.

---

# 8. THÔNG TIN NGÂN HÀNG

Field:

```text
Tên ngân hàng
Số tài khoản
Tên chủ tài khoản
Chi nhánh nếu cần
```

Đây là dữ liệu nhạy cảm.

Phải có permission riêng để xem/export nếu cần.

Không hiển thị số tài khoản đầy đủ cho user không có quyền.

---

# 9. THUẾ / BHXH

Field:

```text
Mã số thuế cá nhân
Mã số BHXH
```

Có thể bổ sung các field theo nhu cầu HR về sau nhưng không tự ý thêm quá mức.

---

# 10. NGƯỜI LIÊN HỆ KHẨN CẤP

Field:

```text
Họ tên
Quan hệ
Số điện thoại
Ghi chú
```

Cho phép ít nhất một contact.

Có thể support nhiều contact nếu schema hợp lý.

---

# 11. HỒ SƠ ĐÍNH KÈM

Hỗ trợ tài liệu:

```text
CCCD
Hợp đồng
CV
Bằng cấp
Chứng chỉ
Giấy khám sức khỏe nếu có
Tài liệu khác
```

Mỗi document record cần:

```text
document_type
title
file_id
issued_date nếu có
expiry_date nếu có
note
uploaded_by
uploaded_at
```

File private.

Không lưu raw public URL trong business record.

---

# 12. PROFILE COMPLETENESS

Không bắt HR phải nhập tất cả field ngay lần đầu.

Tạo employee với tối thiểu:

```text
Mã nhân viên
Họ tên
Số điện thoại
Phòng ban
Chức vụ
Loại nhân sự
Ngày vào làm
Trạng thái
```

Sau đó hiển thị:

```text
Hồ sơ hoàn thành 75%
```

Profile completeness chỉ là UX helper.

Không dùng nó làm business rule cứng nếu không cần.

---

# 13. HỒ SƠ CÔNG NHÂN TẠM

Người giám sát về sau có thể thêm nhân sự phát sinh tại công trường.

Prompt này phải hỗ trợ data model cho trường hợp:

```text
Temporary Worker
```

Field tối thiểu:

```text
Họ tên *
Số điện thoại nếu có
Loại nhân sự
Đơn vị / nhà thầu nếu có
Ghi chú
Trạng thái hồ sơ: Chờ HR hoàn thiện
```

Sau đó HR có thể chuyển thành hồ sơ hoàn chỉnh mà không tạo record trùng.

Cần có merge/complete flow an toàn nếu worker đã tồn tại.

---

# 14. CHỐNG TRÙNG NHÂN SỰ

Khi tạo mới, kiểm tra hợp lý:

- employee_code
- CCCD nếu có
- phone nếu có
- email nếu có

Không tự động merge chỉ vì trùng tên.

Nếu nghi trùng:

```text
Có thể đã tồn tại một hồ sơ tương tự.
```

Cho HR xem và quyết định.

---

# 15. QUÁ TRÌNH CÔNG TÁC

Không chỉ lưu trạng thái hiện tại.

Phải lưu lịch sử thay đổi:

```text
Ngày
Loại thay đổi
Giá trị cũ
Giá trị mới
Người thực hiện
Lý do
```

Các event quan trọng:

```text
Gia nhập công ty
Chuyển phòng ban
Thay đổi chức vụ
Thay đổi quản lý
Thay đổi loại nhân sự
Thử việc → chính thức
Tạm nghỉ
Quay lại làm
Nghỉ việc
```

Không được ghi đè lịch sử.

---

# 16. EMPLOYMENT HISTORY

Có thể dùng event-based history hoặc effective-dated records.

Yêu cầu chính:

- xem được timeline
- biết thời điểm thay đổi
- biết ai thực hiện
- export được sau này
- báo cáo lịch sử không bị mất do dữ liệu hiện tại thay đổi

---

# 17. SNAPSHOT LỊCH SỬ

Các nghiệp vụ đã đóng kỳ về sau có thể cần snapshot tên/phòng ban/chức vụ tại thời điểm phát sinh.

Prompt này chuẩn bị model đủ để các module sau tham chiếu an toàn.

Không buộc mọi table sao chép toàn bộ PII.

---

# 18. ROUTING MODULE NHÂN SỰ

Bắt buộc dùng routing thật.

Ví dụ:

```text
/employees
/employees/new

/employees/:id/profile
/employees/:id/employment
/employees/:id/contracts
/employees/:id/documents
/employees/:id/history
/employees/:id/account
```

Nếu cần thêm:

```text
/employees/:id/sensitive
```

chỉ khi UX thật sự hợp lý.

Không gộp tất cả vào một giant page.

---

# 19. EMPLOYEE LIST PAGE

Trang:

```text
/employees
```

Desktop DataTable gồm tối thiểu:

```text
Mã NV
Họ tên
Phòng ban
Chức vụ
Loại nhân sự
Số điện thoại
Ngày vào làm
Trạng thái
```

Không mặc định show CCCD/bank/BHXH ở list.

Filter:

```text
Tìm kiếm
Phòng ban
Chức vụ
Loại nhân sự
Trạng thái
Ngày vào làm nếu cần
```

Main filters nên reflected vào URL query.

---

# 20. EMPLOYEE DETAIL HEADER

Ví dụ:

```text
Nguyễn Văn A
NV001 · Kỹ thuật · Kỹ sư
Đang làm việc
```

Tabs route-backed:

```text
Hồ sơ
Công việc
Hợp đồng
Tài liệu
Lịch sử
Tài khoản
```

Các prompt sau có thể thêm:

```text
Chấm công
Nghỉ phép
Bảng công
```

Không implement sâu ở đây.

---

# 21. CREATE EMPLOYEE UX

Form tạo mới không nhét modal lớn.

Route:

```text
/employees/new
```

Form chia section:

```text
Thông tin cơ bản
Thông tin công việc
Liên hệ
```

Chỉ yêu cầu field bắt buộc để tạo.

Sau khi save:

```text
/employees/:id/profile
```

---

# 22. EDIT EMPLOYEE UX

Hai mức:

## Quick edit

Drawer cho section nhỏ.

## Full edit

Page route nếu nhiều field.

Không bắt buộc toàn bộ edit phải ở một modal.

---

# 23. MOBILE EMPLOYEE UX

Mobile chủ yếu không dành cho HR nhập hồ sơ dài.

Nhưng phải hỗ trợ:

- xem hồ sơ cơ bản
- xem trạng thái
- xem thông tin công việc
- xem tài khoản/cá nhân nếu là self-service

Không nhét desktop table.

Admin/HR mobile có thể có simplified list.

---

# 24. TÀI KHOẢN HỆ THỐNG

Tài khoản là entity riêng.

Employee detail có action:

```text
[Cấp tài khoản hệ thống]
```

Nếu đã có:

```text
Tài khoản đang hoạt động
```

Cho phép:

- xem username/email login
- reset/issue password flow an toàn
- disable account
- enable account
- revoke sessions nếu framework hỗ trợ

Không lưu plain password.

---

# 25. ĐĂNG NHẬP THỐNG NHẤT

Một login screen cho toàn hệ thống.

Không tạo login riêng cho:

- HR
- công nhân
- admin
- giám sát

Account có thể support identifier:

```text
Email
Số điện thoại
Mã nhân viên
```

Nhưng tất cả map về cùng một user account.

Nếu auth provider không support trực tiếp nhiều identifier, thiết kế lớp resolution phù hợp mà không làm giảm security.

---

# 26. ACCOUNT PROVISIONING

Flow đề xuất:

```text
HR tạo hồ sơ nhân viên
        ↓
Người có quyền chọn "Cấp tài khoản"
        ↓
Tạo User Account
        ↓
Gán role
        ↓
Gửi hoặc hiển thị hướng dẫn đăng nhập phù hợp
```

Không auto tạo account cho mọi worker nếu không cần.

---

# 27. ACCOUNT LIFECYCLE

Trạng thái:

```text
Pending activation
Active
Disabled
Locked nếu auth hỗ trợ
```

Khi nhân viên nghỉ việc:

- employee record vẫn tồn tại
- user account bị disable theo policy
- không xóa historical records
- revoke active sessions nếu phù hợp

Không hard-delete user khi offboarding.

---

# 28. ROLE & PERMISSION MODEL

Bắt buộc:

```text
User
  ↓
Roles
  ↓
Permissions
```

Một user có thể có nhiều role.

Role chỉ là package permissions.

Ví dụ role:

```text
Nhân viên
Kỹ sư
Giám sát
Trưởng phòng
HR
Kế toán
Kho
Xuất nhập khẩu
Ban giám đốc
Admin
```

Không hard-code feature bằng role name.

---

# 29. PERMISSION NAMING

Dùng permission có namespace rõ.

Ví dụ:

```text
employee.view
employee.view_sensitive
employee.create
employee.edit
employee.edit_sensitive
employee.archive
employee.export_basic
employee.export_sensitive

account.view
account.create
account.disable
account.assign_role

role.view
role.manage

department.manage
position.manage
```

Tên có thể điều chỉnh theo convention project nhưng phải rõ.

---

# 30. UI PERMISSION CHECK

Không:

```ts
if (role === "HR")
```

Dùng:

```ts
can("employee.create")
```

Server cũng check cùng permission semantics.

Frontend không phải security boundary.

---

# 31. ADMIN ROLE MANAGEMENT

Admin UI:

```text
/settings/roles
/settings/permissions
```

Cho phép:

- tạo role
- đổi tên role
- mô tả role
- chọn permission
- gán user
- xem số người đang dùng role

Không cho xóa role đang sử dụng mà không xử lý dependency.

---

# 32. MULTIPLE ROLES

Ví dụ một người:

```text
Trưởng phòng kỹ thuật
+
Người duyệt
```

Effective permissions là union có kiểm soát.

Không tạo role tổ hợp kiểu:

```text
Trưởng phòng kỹ thuật kiêm người duyệt nghỉ phép
```

chỉ để giải quyết trường hợp lẻ.

---

# 33. ADMIN SUPERUSER

Admin có quyền hệ thống cao nhất nhưng:

- hành động vẫn audit
- không bỏ qua mọi validation vô lý
- destructive operation vẫn confirm
- sensitive actions cần explicit UI
- không dùng admin token ở client

---

# 34. SELF PROFILE

User đăng nhập có thể xem:

```text
Thông tin cá nhân
Thông tin công việc cơ bản
Tài khoản
```

Không tự sửa tất cả HR fields.

Field nào self-service được sửa phải cấu hình hoặc permission rõ.

Ví dụ có thể cho tự sửa:

```text
số điện thoại cá nhân
địa chỉ hiện tại
avatar
```

nếu công ty muốn.

Prompt này có thể tạo foundation, không cần bật mọi field.

---

# 35. QUẢN LÝ TRỰC TIẾP

Employee có thể có:

```text
manager_employee_id
```

Không lưu tên manager dạng text.

Phải chống:

- employee tự làm manager của chính mình
- vòng lặp quản lý trực tiếp đơn giản nếu model cho phép

Lịch sử thay đổi manager phải được ghi lại.

---

# 36. PHÒNG BAN HIERARCHY

Có thể support:

```text
parent_department_id
```

nếu công ty cần phòng/ban con.

Không bắt buộc UI phức tạp nếu hiện tại tổ chức nhỏ.

Architecture phải không chặn mở rộng.

---

# 37. TRẠNG THÁI NGHỈ VIỆC

Offboarding phải ghi:

```text
Ngày nghỉ việc
Lý do nếu HR nhập
Người xử lý
Thời gian xử lý
```

Không xóa hồ sơ.

Account disable theo policy.

Không tự xóa tài liệu.

---

# 38. ARCHIVE VS DELETE

Đối với employee:

Ưu tiên:

```text
archive / inactive
```

thay vì hard delete.

Hard delete chỉ dùng trong trường hợp record tạo nhầm và chưa có dependency, với permission cao và confirm rõ.

---

# 39. SENSITIVE DATA UI

Các field:

- CCCD
- bank account
- tax
- BHXH
- sensitive documents

phải:

- có permission riêng
- có masking
- không xuất hiện ở default list
- không đưa vào global search result snippet nếu không có quyền
- không leak qua client payload nếu user không được xem

Không chỉ hide bằng CSS.

---

# 40. FILE SECURITY

Employee document:

- private storage
- stable internal reference
- authorization before fetch
- short-lived signed access nếu cần
- content type validate
- size limit
- safe file name
- audit upload/delete
- không public bucket cho CCCD/hợp đồng

---

# 41. AUDIT

Các hành động phải audit:

```text
Tạo hồ sơ
Sửa thông tin quan trọng
Sửa CCCD
Sửa ngân hàng
Thay đổi phòng ban
Thay đổi chức vụ
Thay đổi manager
Thay đổi trạng thái
Tạo tài khoản
Disable tài khoản
Gán role
Bỏ role
Upload/xóa tài liệu nhạy cảm
```

Audit entry phải có:

```text
actor
entity
action
timestamp
before
after
reason nếu yêu cầu
```

---

# 42. REASON FOR CHANGE

Một số thay đổi quan trọng nên yêu cầu lý do:

- sửa ngày vào làm sau khi đã có lịch sử
- sửa ngày nghỉ việc
- sửa CCCD
- sửa department/position retroactively nếu ảnh hưởng lịch sử
- disable account thủ công

Không bắt nhập reason cho mọi typo nhỏ.

---

# 43. VALIDATION

Ví dụ:

```text
employee_code unique
phone valid
email valid
CCCD format hợp lý nếu nhập
start_date <= official_date nếu cả hai có
contract start <= end
termination_date >= join_date
```

Không áp rule quá cứng cho dữ liệu thực tế Việt Nam nếu chưa chắc.

Validation phải rõ tiếng Việt.

---

# 44. SEARCH

Search employee theo:

```text
Mã nhân viên
Họ tên
Số điện thoại
Email
```

Sensitive identifier như CCCD chỉ search nếu user có permission phù hợp.

Không expose kết quả nhạy cảm.

---

# 45. PAGINATION

Không fetch toàn bộ employee list.

Dùng server-side pagination khi data lớn.

Filter/search/sort nên chạy server-side nếu phù hợp.

---

# 46. EMPLOYEE SELECTOR COMPONENT

Tạo reusable employee picker cho các module tương lai:

```text
Search employee
Department filter
Status
Avatar/name/code
```

Dùng lại cho:

- manager
- project assignment
- approvals
- warehouse assignee
- attendance supervisor

Không tạo employee dropdown khác nhau ở mỗi module.

---

# 47. WORKER SELECTOR

Có thể dùng cùng employee picker nhưng support filter:

```text
worker_type
active
department
contractor
```

Không duplicate component nếu không cần.

---

# 48. DATA MODEL GỢI Ý

Không bắt buộc đúng tên table, nhưng domain nên tách hợp lý:

```text
employees
employee_profiles
employee_addresses hoặc fields phù hợp
employment_records
employee_contracts
employee_documents
employee_emergency_contacts
employee_bank_accounts hoặc sensitive profile
departments
positions
employment_types

users/accounts mapping
roles
permissions
user_roles
role_permissions

employment_history / employee_events

file_metadata
audit_logs
```

Không over-normalize vô lý.

Không nhét tất cả vào một JSON column duy nhất.

---

# 49. EMPLOYEE NUMBER / ID

Phân biệt:

```text
database id
employee_code
```

Database id có thể UUID.

Employee code là business identifier.

Không dùng employee code làm foreign key chính nếu làm khó đổi format sau này.

---

# 50. API

Chuẩn bị endpoint dạng:

```text
GET    /api/v1/employees
POST   /api/v1/employees

GET    /api/v1/employees/:id
PATCH  /api/v1/employees/:id

GET    /api/v1/employees/:id/history
GET    /api/v1/employees/:id/contracts
GET    /api/v1/employees/:id/documents

POST   /api/v1/employees/:id/accounts
PATCH  /api/v1/accounts/:id/status

GET    /api/v1/roles
POST   /api/v1/roles
PATCH  /api/v1/roles/:id
```

Không bắt buộc REST nếu project đang có convention khác, nhưng API contract phải rõ và versioned.

---

# 51. DTO / RESPONSE SECURITY

Không trả toàn bộ employee object cho mọi request.

Tách representation:

```text
EmployeeSummary
EmployeeBasicProfile
EmployeeSensitiveProfile
EmployeeAccountView
```

Permission quyết định field được trả về.

Không gửi sensitive data xuống client rồi chỉ hide bằng UI.

---

# 52. CONCURRENCY

Khi hai HR cùng sửa hồ sơ, tránh silent overwrite.

Nếu stack phù hợp, dùng:

- updated_at
- version
- optimistic concurrency

Nếu record đã thay đổi:

```text
Dữ liệu vừa được cập nhật bởi người khác.
Vui lòng tải lại trước khi lưu.
```

---

# 53. EXPORT HOOK

Prompt này chưa xây Report Engine.

Nhưng cần chuẩn bị permission:

```text
employee.export_basic
employee.export_sensitive
```

Và API/service có thể cung cấp dữ liệu cho report engine sau này.

Không hard-code Excel generation ở module này.

---

# 54. UI — NHÂN SỰ

Desktop list:

```text
Nhân viên                           [+ Thêm nhân viên]

[Tìm kiếm] [Phòng ban] [Chức vụ] [Loại] [Trạng thái]

------------------------------------------------------
Mã | Họ tên | Phòng ban | Chức vụ | Loại | Trạng thái
------------------------------------------------------
```

Action menu:

```text
Xem hồ sơ
Chỉnh sửa
Tài khoản
Lưu trữ
```

Tùy permission.

---

# 55. PROFILE UI

Layout:

```text
Employee header

Tabs

Section cards:
- Thông tin cơ bản
- Liên hệ
- Công việc
- CCCD
- Ngân hàng
- Thuế/BHXH
- Người liên hệ khẩn cấp
```

Không show tất cả sensitive data ngay nếu user không cần.

---

# 56. CONTRACT UI

List hợp đồng theo thời gian:

```text
Số hợp đồng
Loại
Bắt đầu
Kết thúc
Trạng thái
Tài liệu
```

Có timeline hoặc table.

Không cần contract editor phức tạp beyond scope.

---

# 57. HISTORY UI

Timeline:

```text
01/05/2025
Gia nhập công ty
Nhân viên kỹ thuật

01/01/2026
Thay đổi chức vụ
Nhân viên kỹ thuật → Kỹ sư hiện trường
```

Có actor/timestamp nếu cần.

Không render raw JSON diff.

---

# 58. ACCOUNT UI

Employee account tab:

```text
Trạng thái tài khoản
Identifier đăng nhập
Vai trò
Ngày kích hoạt
Lần đăng nhập gần nhất nếu auth support

[Cấp tài khoản]
[Vô hiệu hóa]
[Quản lý vai trò]
```

Không show password.

---

# 59. ADMIN — ROLE UI

Role page:

```text
Tên vai trò
Mô tả
Số người dùng
Permissions
```

Permission group:

```text
Nhân sự
Chấm công
Nghỉ phép
Dự án
Kho
XNK
Báo cáo
Hệ thống
```

Prompt này chỉ triển khai permission liên quan hiện có + structure cho future permission.

Không tạo fake permission không sử dụng nếu gây rối.

---

# 60. ROLE PERMISSION UX

Checkbox permission có description ngắn.

Ví dụ:

```text
[x] Xem danh sách nhân viên
[x] Tạo nhân viên
[x] Chỉnh sửa hồ sơ
[ ] Xem thông tin nhạy cảm
[ ] Xuất dữ liệu nhạy cảm
```

Không yêu cầu admin hiểu permission key kỹ thuật.

Permission key chỉ hiển thị trong advanced/debug nếu cần.

---

# 61. DEFAULT ROLES

Có thể seed role tối thiểu:

```text
Admin
HR
Nhân viên
Giám sát
```

Nhưng không hard-code role ID.

Các role khác có thể thêm qua admin.

Nếu seed permission, phải dùng stable key.

---

# 62. ADMIN LOCKOUT PROTECTION

Không để admin vô tình:

- xóa role cuối cùng có quyền quản trị
- tự gỡ toàn bộ quyền quản trị khỏi tài khoản cuối cùng
- disable tài khoản admin cuối cùng

Implement guard hợp lý.

Không dùng backdoor account.

---

# 63. DELETE / ARCHIVE DOCUMENT

Document delete phải:

- confirm
- audit
- soft delete nếu retention policy yêu cầu
- không orphan binary nếu delete hoàn toàn
- không delete file đang được record khác tham chiếu

---

# 64. PRIVACY

Không hiển thị PII nhiều hơn cần thiết.

Global directory có thể chỉ show:

```text
Tên
Phòng ban
Chức vụ
Email công ty
Số điện thoại công việc nếu có
```

Không show:

```text
CCCD
ngân hàng
BHXH
địa chỉ nhà
```

cho user bình thường.

---

# 65. MOBILE SELF-SERVICE

Trang Cá nhân mobile:

```text
Avatar
Họ tên
Mã nhân viên
Phòng ban
Chức vụ
Số điện thoại
Email
```

Các chức năng:

```text
Xem hồ sơ
Đổi mật khẩu
Đăng xuất
```

Không cần full HR editor trên mobile employee experience.

---

# 66. EMPTY / LOADING / ERROR

Mỗi page:

- loading
- empty
- error
- permission denied

Ví dụ empty:

```text
Chưa có nhân viên
Thêm hồ sơ đầu tiên để bắt đầu quản lý nhân sự.
```

---

# 67. RESPONSIVE

Desktop:

- data table
- multi-section detail

Mobile HR list:

- compact list
- search
- essential filters
- tap to detail

Không horizontal table bắt buộc.

---

# 68. TEST CASES BẮT BUỘC

Ít nhất test:

### Employee

- tạo employee tối thiểu
- duplicate employee_code
- edit profile
- sensitive permission
- archive
- offboard
- history generated

### Account

- employee không account
- cấp account
- disable account
- employee history vẫn còn
- cannot expose password

### RBAC

- user có role
- user nhiều role
- permission union
- frontend hide
- API deny
- admin lockout guard

### Sensitive data

- no permission → API không trả field
- permission → xem được
- export permission tách biệt

### Routing

- list → detail
- route-backed tabs
- refresh giữ page
- browser back đúng

---

# 69. ACCEPTANCE CRITERIA

## Data model

- [ ] Employee tách User Account.
- [ ] Worker có thể không có account.
- [ ] Department/position reference bằng ID.
- [ ] Có employment history.
- [ ] Có contracts riêng.
- [ ] Có documents riêng.
- [ ] Sensitive data được phân quyền.

## UI

- [ ] Employee list chuẩn.
- [ ] Create employee là page.
- [ ] Detail có route-backed tabs.
- [ ] Sensitive info không show mặc định.
- [ ] Mobile usable.

## Accounts

- [ ] Cấp account từ hồ sơ.
- [ ] Disable account không xóa employee.
- [ ] Login thống nhất.
- [ ] Không lưu plain password.

## RBAC

- [ ] Role ≠ permission.
- [ ] User có multiple roles.
- [ ] UI dùng permission key.
- [ ] API check server-side.
- [ ] Admin có role management.
- [ ] Có guard tránh lockout admin cuối.

## Security

- [ ] CCCD/private documents không public.
- [ ] Sensitive API DTO tách riêng.
- [ ] No PII leak in logs.
- [ ] Audit các thay đổi quan trọng.

## Quality

- [ ] Migration rõ.
- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Production build pass.

---

# 70. THỨ TỰ TRIỂN KHAI

1. Inspect schema/auth hiện tại.
2. Thiết kế employee domain.
3. Thiết kế department/position/employment type.
4. Thiết kế employee history.
5. Thiết kế contract/document model.
6. Thiết kế sensitive data protection.
7. Thiết kế account mapping.
8. Thiết kế role/permission.
9. Migrations.
10. API.
11. Employee list UI.
12. Create employee.
13. Detail pages.
14. Account UI.
15. Role management UI.
16. Mobile self-profile.
17. Audit.
18. Tests.
19. Responsive/accessibility review.
20. Build quality gate.

---

# 71. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Database

- bảng/migration mới
- relationship chính

## API

- endpoints
- permission protection

## UI

- routes/pages
- reusable components

## RBAC

- roles
- permission keys
- effective permission strategy

## Sensitive data

- storage/access strategy

## Tests

- test đã chạy
- kết quả

## Known limitations

Chỉ ghi limitation thật.

---

# 72. QUY TẮC CUỐI

Không tự triển khai chấm công hay nghỉ phép trong prompt này.

Không dùng employee name làm identity.

Không tạo account bắt buộc cho tất cả công nhân.

Không xóa lịch sử khi nhân viên nghỉ việc.

Không hard-code role name vào feature.

Không gửi sensitive employee data xuống frontend nếu không có quyền.

Không tạo giant employee page.

**Dừng sau khi module Nhân sự + account + RBAC nền tảng hoàn chỉnh, test/build pass và báo cáo kết quả.**
