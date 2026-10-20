# PROMPT 09 — CẬP NHẬT DỰ ÁN, NHẬT KÝ HIỆN TRƯỜNG, TÌNH HÌNH TIẾN ĐỘ VÀ DASHBOARD CHO QUẢN LÝ/BAN GIÁM ĐỐC

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Các prompt trước đã xác lập:

- kiến trúc nền tảng
- routing thật
- enterprise design system
- frontend desktop/mobile
- module Nhân sự
- User Account tách Employee Record
- Role / Permission
- Admin Console / Branding
- chấm công cá nhân
- Project / Worksite
- phân công giám sát và công nhân
- điểm danh công nhân tập thể
- nghỉ phép / approval / phép năm / PDF
- ca làm / bảng công / khóa kỳ / Excel
- API-first
- configuration over hard-code
- audit foundation
- private file storage

Prompt này triển khai:

1. Cập nhật tình hình dự án.
2. Nhật ký hiện trường.
3. Tiến độ dạng cập nhật có cấu trúc.
4. Vấn đề / rủi ro.
5. Ảnh hiện trường.
6. Tài liệu đính kèm.
7. Dòng thời gian dự án.
8. Ghim cập nhật quan trọng.
9. Trạng thái tổng thể của dự án.
10. Dashboard quản lý.
11. Dashboard Ban giám đốc.
12. Theo dõi dự án cần chú ý.
13. Notification hook.
14. Liên kết với Worksite / Worker Attendance.
15. Quyền xem/đăng cập nhật.
16. Nền tảng để sau này mở rộng Task / Milestone nhưng không triển khai quá mức ở V1.

Không xây full Jira / Base Work / Kanban / Gantt trong prompt này.

---

# 1. MỤC TIÊU NGHIỆP VỤ

Hiện tại thông tin dự án có thể đang phân tán qua:

```text
Zalo
Tin nhắn
Ảnh hiện trường
Trao đổi miệng
File rời
```

Hệ thống mới phải tạo một nguồn thông tin chung:

```text
Project
↓
Project Updates
↓
Progress / Issue / Material / Safety / Change / General
↓
Timeline
↓
Dashboard
↓
Management / Director visibility
```

Mục tiêu:

- giám sát có thể báo nhanh từ điện thoại
- kỹ sư văn phòng có thể cập nhật từ desktop
- Project Manager thấy được tình hình
- Ban giám đốc không cần đọc toàn bộ tin nhắn vẫn biết dự án nào có vấn đề
- thông tin giữ được lịch sử và tìm lại được

---

# 2. KHÔNG BIẾN MODULE THÀNH CHAT

Không xây kiểu:

```text
A: hôm nay làm gì?
B: đang làm
A: ảnh đâu?
B: gửi đây
```

Mỗi cập nhật phải là record có cấu trúc:

```text
Project
Worksite
Author
Timestamp
Update type
Title
Content
Status
Issue severity nếu có
Attachments
Pinned
```

Có thể có comment nhẹ sau này, nhưng Project Update không được biến thành chat app.

---

# 3. KHÔNG ÉP BÁO CÁO % TIẾN ĐỘ Ở V1

Không bắt user nhập:

```text
73%
82%
95%
```

nếu công ty chưa có chuẩn WBS / milestone rõ.

V1 ưu tiên trạng thái định tính:

```text
Chưa bắt đầu
Đang thực hiện
Chờ xử lý
Tạm dừng
Hoàn thành
```

Project-level health:

```text
Đúng tiến độ
Có rủi ro
Chậm tiến độ
Tạm dừng
Hoàn thành
```

Nếu sau này có milestone/WBS, mới thêm % progress chính thức.

---

# 4. ROUTING

Bắt buộc route thật.

Project:

```text
/projects/:id/overview
/projects/:id/updates
/projects/:id/updates/new
/projects/:id/updates/:updateId
/projects/:id/team
/projects/:id/schedule
/projects/:id/worker-attendance
/projects/:id/documents
/projects/:id/history
```

Management dashboard:

```text
/project-monitoring
/project-monitoring/issues
/project-monitoring/recent
```

Không giant page.

---

# 5. PROJECT UPDATE TYPES

Admin có thể cấu hình các loại update trong giới hạn an toàn.

Default:

```text
Tiến độ
Vấn đề
Vật tư
An toàn
Thay đổi
Thông tin chung
```

Mỗi type có:

```text
code
label
active
semantic icon
semantic color nhẹ
```

Không cho custom arbitrary workflow ở type nếu chưa cần.

---

# 6. PROJECT UPDATE DATA

Mỗi update cần:

```text
id
project_id
worksite_id optional
author_employee_id
update_type
title
content
status
issue_flag
issue_severity optional
pinned
created_at
updated_at
```

Có thể thêm:

```text
related_attendance_session_id optional
```

để link với điểm danh/ngày hiện trường.

---

# 7. TITLE

Title nên ngắn.

Ví dụ:

```text
Thiếu vật tư tại khu vực QC03
```

Không bắt title nếu UX mobile cần nhanh, có thể auto-generate từ content trong trường hợp nhất định.

Nhưng system record phải có summary dễ đọc.

---

# 8. CONTENT

Content dùng plain text / rich text nhẹ.

Cho phép:

- paragraph
- bullet list
- line break

Không cần full HTML editor.

Không cho arbitrary HTML/script.

Ưu tiên editor đơn giản, mobile-friendly.

---

# 9. STATUS CỦA UPDATE

Update status khác project health.

Ví dụ:

```text
Đang thực hiện
Chờ xử lý
Đã xử lý
Hoàn thành
```

Không trộn với `Đúng tiến độ / Chậm tiến độ` của project overall.

---

# 10. ISSUE FLAG

Có checkbox:

```text
Có vấn đề cần xử lý?
```

Nếu yes:

```text
Mức độ:
Thấp
Trung bình
Cao
Nghiêm trọng
```

Không dùng severity chỉ bằng màu.

Có text label rõ.

---

# 11. ISSUE SEVERITY

Concept:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

UI tiếng Việt:

```text
Thấp
Trung bình
Cao
Nghiêm trọng
```

Mỗi severity có semantic color.

Không dùng đỏ cho mọi issue.

---

# 12. PINNED UPDATE

Project Manager / người có quyền có thể:

```text
Ghim cập nhật
```

Pinned update hiển thị đầu project overview.

Ví dụ:

```text
CẦN CHÚ Ý

Thiếu vật tư khu vực QC03
Cập nhật 2 giờ trước
```

Không cho mọi user ghim nếu không có permission.

---

# 13. PROJECT HEALTH

Project có overall health riêng:

```text
ON_TRACK
AT_RISK
DELAYED
PAUSED
COMPLETED
```

UI:

```text
Đúng tiến độ
Có rủi ro
Chậm tiến độ
Tạm dừng
Hoàn thành
```

Không tự suy ra 100% bằng AI.

Có thể suggest dựa trên issue, nhưng final state phải do người có quyền xác nhận ở V1.

---

# 14. AI KHÔNG TỰ THAY PROJECT HEALTH

Không để hệ thống tự đổi:

```text
Đúng tiến độ → Chậm tiến độ
```

chỉ dựa trên một update.

Có thể tạo:

```text
Suggested Attention
```

nhưng Project Manager/authorized user xác nhận.

---

# 15. PROJECT OVERVIEW

Route:

```text
/projects/:id/overview
```

Hiển thị:

```text
Project name
Status
Health
Project Manager
Start/end
Current worksite
Team size
Today's attendance summary
Pinned issue
Recent updates
```

Không làm dashboard quá nhiều chart.

---

# 16. PROJECT UPDATE TIMELINE

Route:

```text
/projects/:id/updates
```

Timeline:

```text
09/09/2026 15:20
Nguyễn Văn Minh · Giám sát
VẤN ĐỀ

Thiếu vật tư tại khu vực QC03.

[3 ảnh]

Cao
Đang xử lý
```

Bên dưới:

```text
09/09/2026 10:05
Trần Văn A · Kỹ sư
TIẾN ĐỘ

Đã hoàn thành kiểm tra...
```

Dễ scan.

---

# 17. FILTER TIMELINE

Filter:

```text
Loại cập nhật
Tác giả
Worksite
Issue only
Severity
Date range
Status
Pinned
```

Search:

```text
title/content
```

Không cần full-text search engine riêng nếu DB search đủ.

---

# 18. MOBILE — GIÁM SÁT

Mobile project update phải cực nhanh.

CTA:

```text
+ Cập nhật dự án
```

Form:

```text
Loại cập nhật *
Tiêu đề
Nội dung *
Tình trạng
Có vấn đề cần xử lý?
Ảnh / tài liệu
```

Không form 30 fields.

---

# 19. QUICK UPDATE FROM ATTENDANCE SESSION

Sau khi supervisor submit morning attendance:

```text
✓ Điểm danh hoàn tất

[ Thêm nội dung công việc hôm nay ]
```

Nếu user nhập:

```text
Vệ sinh và kiểm tra QC03
```

hệ thống có thể tạo Project Update draft / quick update.

Không bắt nhập lại project/worksite/date.

---

# 20. LINK ATTENDANCE SESSION

Project Update có thể reference:

```text
worker_attendance_session_id
```

để:

- biết update liên quan buổi điểm danh nào
- reuse photo references nếu phù hợp
- tránh upload ảnh trùng

Không copy binary photo.

---

# 21. REUSE PHOTO VS NEW PHOTO

Nếu supervisor muốn dùng ảnh điểm danh làm ảnh hiện trường:

Cho phép:

```text
Chọn ảnh từ phiên điểm danh hôm nay
```

hoặc:

```text
Chụp ảnh mới
```

Ảnh được reference qua file metadata.

Không duplicate storage file nếu không cần.

---

# 22. ATTACHMENTS

Support:

```text
Image
PDF
Excel
Document
```

Validate:

- MIME
- size
- extension
- permission

Storage private.

Không public URL.

---

# 23. IMAGE HANDLING

Reuse foundation:

- thumbnail
- compression
- private storage
- lightbox
- lazy load
- next/previous
- no full-size preload

Ảnh hiện trường có thể ưu tiên camera sau trên mobile.

---

# 24. ATTACHMENT METADATA

Mỗi attachment:

```text
file_id
update_id
attachment_type
caption optional
uploaded_by
uploaded_at
sort_order
```

Không dùng file name làm identity.

---

# 25. EDIT UPDATE

Author có thể sửa trong policy window nếu permission cho phép.

Sau edit:

```text
Đã chỉnh sửa
```

Lưu history.

Không overwrite âm thầm.

---

# 26. UPDATE HISTORY

Lưu:

```text
version
before
after
edited_by
edited_at
reason nếu update quan trọng
```

Không cần show raw JSON.

UI:

```text
Nội dung đã được chỉnh sửa lúc 16:02
```

Có thể xem lịch sử nếu permission.

---

# 27. DELETE UPDATE

Không hard delete processed/project-history update mặc định.

Dùng:

```text
Archived / Removed
```

nếu cần.

Delete phải:

- permission
- confirm
- audit

Nếu update liên quan issue đã được xử lý, giữ history.

---

# 28. COMMENT — PHẠM VI V1

Có thể implement comment nhẹ nếu scope cho phép.

Comment:

```text
content
author
created_at
```

Không:

- reaction
- emoji system
- sticker
- social feed
- nested comments sâu

Nếu chưa cần, chuẩn bị extension point và bỏ UI.

---

# 29. MENTION — KHÔNG BẮT BUỘC

Không cần @mention engine ở V1.

Nếu có notification hook, Project Manager nhận issue high/critical theo config.

---

# 30. NOTIFICATION POLICY

Không spam Ban giám đốc mọi update.

Default:

```text
Progress update
→ project members / manager nếu configured

High/Critical issue
→ Project Manager
→ optional Director/BGĐ
```

Notification preference có thể config sau.

---

# 31. PROJECT UPDATE REQUIRED — CONFIG

Hiện công ty chưa bắt buộc report hàng ngày.

Vì vậy V1:

```text
project.daily_update_required = false
```

Architecture support config per project:

```text
Daily update required
Deadline
Responsible role/user
```

Nhưng không bắt buộc toàn company.

---

# 32. DAILY UPDATE MISSING — FUTURE READY

Nếu project bật required:

Dashboard có thể show:

```text
Chưa có cập nhật hôm nay
```

Không tự phạt/đánh KPI.

Chỉ flag.

---

# 33. PROJECT MONITORING DASHBOARD

Route:

```text
/project-monitoring
```

Dành cho:

- Project Manager
- Management
- Ban giám đốc

Top summary:

```text
Đang hoạt động: 12
Đúng tiến độ: 8
Có rủi ro: 2
Chậm tiến độ: 1
Tạm dừng: 1
```

Không chart quá nhiều.

---

# 34. PROJECT NEEDS ATTENTION

Section:

```text
CẦN CHÚ Ý
```

Hiển thị:

```text
Project
Issue title
Severity
Last updated
Owner
```

Sort:

```text
Critical
High
Old unresolved
```

---

# 35. RECENT UPDATES

Section:

```text
Cập nhật gần đây
```

Không show quá nhiều.

Có:

```text
Xem tất cả
```

---

# 36. STALE PROJECT

Có thể flag:

```text
No update for N days
```

nhưng threshold config.

Không đồng nghĩa project chậm.

Label:

```text
Chưa có cập nhật gần đây
```

không:

```text
Chậm tiến độ
```

---

# 37. DIRECTOR VIEW

Ban giám đốc cần high-level view.

Không show:

- raw attendance
- quá nhiều note
- mọi photo thumbnail

Default:

```text
Project
Health
Latest update
Open high issues
Project Manager
Last update
```

Click mới vào detail.

---

# 38. DIRECTOR FILTER

Filter:

```text
Health
Project Manager
Date
Active/Completed
Issue severity
```

Không cần operational filter quá chi tiết.

---

# 39. PROJECT MANAGER VIEW

Project Manager cần sâu hơn:

- team
- attendance summary
- updates
- issues
- project status
- documents

Không duplicate page với Director.

Permission/view density khác nhau.

---

# 40. ISSUE CENTER

Route:

```text
/project-monitoring/issues
```

Table:

```text
Project
Worksite
Issue
Severity
Status
Owner
Created
Last updated
```

Filter:

```text
Open
Resolved
Severity
Project
Owner
Age
```

---

# 41. ISSUE OWNER

Có optional:

```text
owner_employee_id
```

Không cần full task management.

Issue owner chỉ để biết ai đang phụ trách xử lý.

---

# 42. ISSUE STATUS

```text
OPEN
IN_PROGRESS
RESOLVED
CLOSED
```

Không build Kanban.

---

# 43. RESOLVE ISSUE

Action:

```text
Đánh dấu đã xử lý
```

Có:

```text
Resolution note
Resolved by
Resolved at
```

Không xóa issue update.

---

# 44. REOPEN ISSUE

Có thể:

```text
Mở lại
```

Reason + audit.

Không overwrite resolved timestamp không trace.

---

# 45. PROJECT STATUS VS HEALTH VS ISSUE STATUS

Phải tách:

```text
Project Status
= lifecycle
```

```text
Project Health
= current overall condition
```

```text
Issue Status
= xử lý vấn đề cụ thể
```

Không dùng một enum chung.

---

# 46. PROJECT STATUS

Lifecycle:

```text
PREPARING
ACTIVE
PAUSED
COMPLETED
CLOSED
```

---

# 47. PROJECT HEALTH

Current condition:

```text
ON_TRACK
AT_RISK
DELAYED
PAUSED
COMPLETED
```

---

# 48. UPDATE STATUS

Content-specific:

```text
IN_PROGRESS
WAITING
DONE
```

---

# 49. ISSUE STATUS

```text
OPEN
IN_PROGRESS
RESOLVED
CLOSED
```

---

# 50. PERMISSIONS

Gợi ý:

```text
project_update.create
project_update.view_project
project_update.view_all
project_update.edit_own
project_update.edit_all
project_update.archive

project_update.pin
project_health.update

project_issue.view
project_issue.manage
project_issue.resolve

project_monitoring.view
project_monitoring.view_all
```

Không hard-code role.

---

# 51. PROJECT SCOPE

User xem/đăng update nếu:

```text
permission
+
project assignment/membership
```

Admin/BGĐ có all-scope permission nếu được cấp.

Không vì biết URL mà xem được project khác.

---

# 52. AUTHORSHIP

Mỗi update phải lưu:

```text
author_employee_id
author_name_snapshot
author_project_role_snapshot
```

Lưu snapshot hiển thị tối thiểu để history ổn định.

Không duplicate sensitive info.

---

# 53. PROJECT SNAPSHOT

Update có:

```text
project_name_snapshot
worksite_name_snapshot
```

nếu cần historical context.

Không để đổi project name sau này làm PDF/report lịch sử không hiểu.

---

# 54. TIMESTAMP

Lưu:

```text
created_at_server
captured_at_client nếu offline
```

Nếu mobile offline update:

- giữ client time
- server received time
- sync status

Không trust client time tuyệt đối.

---

# 55. OFFLINE PROJECT UPDATE — OPTIONAL BUT RECOMMENDED

Giám sát công trường có thể mất mạng.

Reuse local persistence foundation.

Cho phép:

```text
Tạo update
Chụp ảnh
Save local draft
Submit pending
Sync later
```

Nếu complexity quá lớn, ít nhất draft offline không mất.

Không để ảnh upload fail làm mất text update.

---

# 56. UPDATE SYNC STATES

```text
LOCAL_DRAFT
PENDING_SYNC
SYNCING
SYNCED
SYNC_FAILED
```

UI:

```text
Chờ đồng bộ
```

Không raw status code.

---

# 57. IDEMPOTENCY

Mỗi mobile-created update có:

```text
client_update_id
```

Retry không tạo duplicate update.

---

# 58. LINK TO WORK NOTE

Worker Attendance prompt có `work_note`.

Nếu user đã nhập work note buổi sáng:

Có thể tạo update từ nó:

```text
Convert / Create project update
```

Không auto publish nếu business chưa muốn.

Có thể auto-save draft.

---

# 59. DOCUMENTS TAB

Project documents vẫn là route riêng:

```text
/projects/:id/documents
```

Update attachment không thay thế document repository.

Nếu file quan trọng:

Có action:

```text
Lưu vào tài liệu dự án
```

nếu permission.

Không duplicate binary file.

---

# 60. SEARCH

Project Update search theo:

- title
- content
- author
- project
- worksite
- type

Không search sensitive employee data.

---

# 61. PAGINATION

Timeline:

- cursor pagination hoặc page
- không fetch toàn lịch sử 3 năm một lần

Infinite scroll có thể dùng mobile, nhưng URL/filter state vẫn rõ.

Desktop có thể page/Load more.

---

# 62. SORTING

Default:

```text
Pinned
↓
Newest first
```

Issue Center:

```text
Severity
↓
Age
```

Có config nếu cần.

---

# 63. UI — NEW UPDATE

Desktop/mobile form:

```text
Loại cập nhật *
Tiêu đề
Nội dung *
Tình trạng
Worksite nếu project có nhiều địa điểm
Có vấn đề cần xử lý?
Mức độ nếu có
Ảnh / tài liệu
```

Buttons:

```text
Lưu nháp
Đăng cập nhật
```

Nếu mobile cần đơn giản, có thể auto-save draft.

---

# 64. UI — UPDATE CARD

Card/timeline item:

```text
Author
Role
Timestamp
Type badge
Title
Content preview
Status
Issue severity
Attachments preview
Pinned marker
```

Card border nhẹ.

Không social-style oversized.

---

# 65. READ MORE

Nếu content dài:

```text
Xem thêm
```

Không render giant update chiếm cả màn hình.

---

# 66. PHOTO GRID

3–4 ảnh preview tối đa trong feed.

Nếu nhiều hơn:

```text
+5
```

Click lightbox.

Không tải full-size.

---

# 67. MOBILE CAMERA

Trong update:

- ưu tiên back camera
- allow gallery upload nếu policy cho phép
- có preview
- compress

Khác attendance selfie.

---

# 68. FILE UPLOAD RECOVERY

Nếu text update đã sync nhưng attachment fail:

```text
Update = synced
Attachment = pending
```

Retry attachment.

Không duplicate update.

---

# 69. DRAFT

User có thể:

```text
Lưu nháp
```

Draft chỉ author + authorized user thấy.

Không xuất hiện dashboard.

---

# 70. PUBLISH

Published update:

- visible theo project scope
- immutable-ish with version history
- notification hook

Không tạo duplicate nếu retry.

---

# 71. COMMENT IF IMPLEMENTED

Nếu có comment:

- only project members/scope
- edit own comment within policy
- audit delete
- no nested deep threads

Comment không làm update status thay đổi tự động.

---

# 72. ACTIVITY LOG

Project history route:

```text
/projects/:id/history
```

Có:

```text
Project status changed
Health changed
Update posted
Issue resolved
Team changed
Worksite changed
```

Không duplicate raw audit logs nếu UI cần human-readable projection.

---

# 73. PROJECT HEALTH CHANGE

Action:

```text
Cập nhật tình trạng dự án
```

Field:

```text
Health
Reason / note
```

Audit.

Nếu set:

```text
DELAYED
```

nên yêu cầu note ngắn.

---

# 74. COMPLETION

Khi project status = COMPLETED/CLOSED:

- vẫn cho xem updates
- không cho new update nếu CLOSED trừ permission override
- project history immutable
- issue unresolved warning trước close

Không auto delete.

---

# 75. OPEN ISSUE BEFORE CLOSING PROJECT

Nếu có high/critical unresolved:

Warning:

```text
Dự án còn 2 vấn đề chưa xử lý.
```

Không nhất thiết block nếu user có override permission.

Reason required nếu close anyway.

---

# 76. DASHBOARD QUERY PERFORMANCE

Không query toàn timeline để build dashboard.

Dùng aggregated queries/indexes.

Need indexes:

```text
project_id
created_at
update_type
issue_flag
issue_severity
issue_status
pinned
author
worksite
```

---

# 77. DATABASE MODEL GỢI Ý

Không bắt buộc tên chính xác.

```text
project_updates
project_update_versions
project_update_attachments

project_issues
project_issue_history

project_health_history

project_update_comments optional
```

Có thể lưu issue fields trực tiếp trong update nếu V1 đơn giản, nhưng nếu lifecycle issue cần riêng thì tách `project_issues`.

Ưu tiên maintainability.

---

# 78. PROJECT ISSUE RELATION

Nếu tách table:

```text
project_issue
- project_id
- source_update_id
- title
- severity
- status
- owner
- resolution
```

Update là context; Issue là trackable problem.

Không bắt buộc mỗi update tạo issue.

---

# 79. API GỢI Ý

Updates:

```text
GET    /api/v1/projects/:id/updates
POST   /api/v1/projects/:id/updates

GET    /api/v1/project-updates/:id
PATCH  /api/v1/project-updates/:id
POST   /api/v1/project-updates/:id/pin
POST   /api/v1/project-updates/:id/archive
```

Issues:

```text
GET    /api/v1/project-issues
GET    /api/v1/projects/:id/issues
POST   /api/v1/project-issues/:id/resolve
POST   /api/v1/project-issues/:id/reopen
```

Health:

```text
POST /api/v1/projects/:id/health
```

Dashboard:

```text
GET /api/v1/project-monitoring/summary
GET /api/v1/project-monitoring/attention
```

---

# 80. SERVER-SIDE AUTHORIZATION

Check:

```text
project membership
permission
update ownership
all-scope permission
issue permission
```

Không chỉ hide UI.

---

# 81. FILE AUTHORIZATION

Attachment viewer:

```text
authenticated
↓
project access
↓
file permission
↓
temporary access
```

Không public link.

---

# 82. NOTIFICATION EVENTS

Emit:

```text
project.update.created
project.issue.created
project.issue.high
project.issue.resolved
project.health.changed
```

Không gửi notification trực tiếp trong domain service nếu event abstraction có sẵn.

---

# 83. DASHBOARD EVENTS

Dashboard read model có thể update theo query hoặc event.

Không cần CQRS phức tạp nếu system nhỏ.

Ưu tiên đơn giản + đúng.

---

# 84. REPORT HOOK

Report Engine sau có thể export:

```text
Project updates
Open issues
Project health history
```

Không implement Excel ở prompt này.

Chỉ expose DTO/service.

---

# 85. PDF HOOK

Sau này có thể sinh:

```text
Báo cáo ngày
Báo cáo tuần
```

từ project updates.

Không implement trong prompt này.

Architecture phải giữ structured data đủ để tổng hợp.

---

# 86. FUTURE TASK SUPPORT

Không xây Task module.

Nhưng issue có thể future link:

```text
task_id
```

hoặc project update can be source of a task.

Không cần field nếu gây overengineering.

Chỉ tránh architecture khóa đường mở rộng.

---

# 87. FUTURE MILESTONE SUPPORT

Không xây Milestone/Gantt.

Project update có thể later reference milestone.

V1 không cần.

---

# 88. SECURITY / PRIVACY

Không cho update upload:

- executable
- arbitrary script
- public URL không kiểm soát

Không expose:

- raw employee sensitive data
- attendance GPS raw
- private file storage path

---

# 89. AUDIT

Audit:

```text
update created
update edited
update archived
update pinned
issue created
issue severity changed
issue resolved
issue reopened
project health changed
```

Không log full binary attachments.

---

# 90. CONCURRENCY

Nếu hai user sửa same update:

- optimistic locking
- conflict message

Không silent overwrite.

Issue resolve double-click:

- idempotent

---

# 91. TEST CASES — UPDATE

- create progress update
- create issue update
- multiple attachments
- upload image
- edit own update
- unauthorized edit denied
- pin permission
- archive with audit
- project membership scope

---

# 92. TEST CASES — ISSUE

- create low/high/critical
- assign owner
- resolve
- reopen
- dashboard attention ordering
- unresolved issue survives project updates

---

# 93. TEST CASES — OFFLINE

Nếu offline support implemented:

- create draft offline
- attach photos
- reload
- draft remains
- reconnect
- sync once
- attachment retry
- no duplicate update

---

# 94. TEST CASES — DASHBOARD

- summary counts
- active only
- health filter
- latest update
- stale project
- open issue sort
- permission scope

---

# 95. TEST CASES — ROUTING

- direct project update route
- refresh
- browser back
- filter query retained
- mobile flow

---

# 96. ACCEPTANCE CRITERIA

## Project Updates

- [ ] Structured updates.
- [ ] Không chat-style.
- [ ] Types rõ.
- [ ] Attachments.
- [ ] Timeline.
- [ ] Edit history.
- [ ] Pin.
- [ ] Draft/publish.

## Issue

- [ ] Issue flag.
- [ ] Severity.
- [ ] Status.
- [ ] Resolve/reopen.
- [ ] Owner optional.
- [ ] Audit.

## Project Health

- [ ] Tách lifecycle status.
- [ ] Health riêng.
- [ ] Manual authorized update.
- [ ] History.
- [ ] Không auto AI override.

## Mobile

- [ ] Form ngắn.
- [ ] Camera/back-camera friendly.
- [ ] Photo compression.
- [ ] Quick update from attendance.
- [ ] Touch-friendly.

## Dashboard

- [ ] Director overview.
- [ ] Project Manager overview.
- [ ] Needs attention.
- [ ] Recent updates.
- [ ] No excessive charts.
- [ ] Permission scope.

## Integration

- [ ] Worksite linked.
- [ ] Worker Attendance session linked.
- [ ] Attachment reuse possible.
- [ ] Notification events.
- [ ] Report-ready.

## Security

- [ ] Project scope server-side.
- [ ] Private attachments.
- [ ] No PII leak.
- [ ] Audit.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Production build pass.
- [ ] Responsive review pass.

---

# 97. THỨ TỰ TRIỂN KHAI

1. Inspect Project/Worksite/Attendance schema.
2. Thiết kế Project Update domain.
3. Thiết kế Issue domain.
4. Thiết kế Project Health history.
5. Thiết kế attachments.
6. Migrations/indexes.
7. Permissions/scope.
8. Update APIs.
9. Issue APIs.
10. Dashboard query APIs.
11. Project update timeline desktop.
12. Mobile update form.
13. Attachment/photo flow.
14. Quick update from attendance.
15. Issue Center.
16. Project Monitoring dashboard.
17. Director view.
18. Edit history/audit.
19. Offline draft if supported.
20. Notifications hook.
21. Tests.
22. Responsive/accessibility.
23. Lint/typecheck/build.
24. Báo cáo.

---

# 98. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Data model

- updates
- issues
- health history
- attachments

## Routes/UI

- project pages
- monitoring pages
- mobile flow

## Permissions

- project scope
- all-scope access

## Dashboard

- summary queries
- needs attention logic

## Integration

- worker attendance
- attachments
- notifications
- future reports

## Tests

- cases
- results

## Known limitations

Chỉ ghi limitation thật.

---

# 99. QUY TẮC CUỐI

Không biến Project Update thành chat.

Không bắt % tiến độ ở V1.

Không tự đánh giá project bằng AI rồi thay trạng thái thật.

Không xây Jira/Kanban/Gantt trong prompt này.

Không duplicate ảnh từ worker attendance nếu có thể reference.

Không spam Ban giám đốc mọi update.

Không cho user xem project ngoài scope.

Không hard delete lịch sử quan trọng.

Không public attachment.

Không giant project page.

**Dừng sau khi Project Updates + Issues + Project Health + Monitoring Dashboard hoàn chỉnh, test/build pass và báo cáo kết quả.**
