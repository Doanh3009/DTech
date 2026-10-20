# PROMPT 04 — ADMIN CONSOLE, BRANDING, LOGO VÀ CẤU HÌNH GIAO DIỆN KHÔNG CẦN SỬA CODE

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
- configuration over hard-code
- audit foundation
- private file storage

Prompt này triển khai một khu vực **Admin Console / Trung tâm quản trị hệ thống**.

Đây **không phải là một role mới**.

Phải phân biệt rõ:

```text
Admin Role / Permission
=
Ai có quyền quản trị

Admin Console
=
Khu vực giao diện để cấu hình hệ thống
```

Một user chỉ được truy cập Admin Console nếu có permission phù hợp.

---

# 1. MỤC TIÊU

Tạo một khu vực quản trị giống tinh thần CRM/CMS để người quản trị nội bộ có thể tự thay đổi các cấu hình thường xuyên mà **không cần sửa code và deploy lại**.

Admin Console phải cho phép quản lý an toàn các nhóm:

1. Branding.
2. Logo.
3. Tên hệ thống.
4. Favicon.
5. Primary color.
6. Appearance settings.
7. Navigation/module visibility.
8. Một số UI defaults.
9. Organization defaults.
10. Date/time/timezone.
11. Module feature toggles.
12. Preview thay đổi.
13. Publish thay đổi.
14. Audit log.
15. Restore/revert cấu hình.

Không xây một website builder tự do.

Không cho admin chỉnh raw CSS/JS.

Không cho admin làm thay đổi có thể phá layout.

---

# 2. NGUYÊN TẮC THIẾT KẾ

Ưu tiên:

```text
Safe configuration > unlimited customization
```

Mục tiêu:

- đủ linh hoạt để vận hành thực tế
- không cần sửa code cho thay đổi nhỏ
- không làm giao diện bị lệch
- không làm admin vô tình phá hệ thống
- dễ hiểu với người quản trị không chuyên lập trình

---

# 3. ROUTING

Tạo route rõ ràng.

Ví dụ:

```text
/system-admin
/system-admin/branding
/system-admin/appearance
/system-admin/navigation
/system-admin/modules
/system-admin/organization
/system-admin/localization
/system-admin/security
/system-admin/audit
/system-admin/config-history
```

Có thể dùng `/admin-console` thay cho `/system-admin` nếu convention project phù hợp.

Không dùng route `/admin` nếu dễ gây nhầm với role hoặc auth admin hiện tại.

---

# 4. ADMIN CONSOLE LAYOUT

Admin Console có thể dùng cùng AppShell nhưng có sub-navigation riêng.

Ví dụ:

```text
TRUNG TÂM QUẢN TRỊ

Thương hiệu
Giao diện
Điều hướng
Module
Tổ chức
Định dạng & thời gian
Bảo mật
Lịch sử cấu hình
Audit log
```

Không cần tạo một website hoàn toàn tách biệt.

---

# 5. BRANDING SETTINGS

Tạo trang:

```text
/system-admin/branding
```

Cho phép admin chỉnh:

```text
Tên hiển thị hệ thống
Tên công ty
Tên viết tắt
Logo chính
Logo compact / icon
Favicon
Logo cho nền sáng
Logo cho nền tối nếu cần
```

Ví dụ:

```text
Tên hệ thống:
Hệ thống nội bộ Châu Tuấn

Tên công ty:
Công ty Châu Tuấn
```

---

# 6. LOGO UPLOAD

Logo upload phải hỗ trợ:

- PNG
- JPG/JPEG
- WEBP
- SVG chỉ nếu sanitize an toàn

Có:

- preview
- replace
- remove
- restore default
- size validation
- dimension validation

Khuyến nghị:

```text
Logo ngang:
tỷ lệ khoảng 3:1 đến 5:1

Logo icon:
1:1

Favicon:
1:1
```

Không hard-code logo trong source code.

Brand asset phải lưu qua file/storage abstraction của project.

---

# 7. LOGO FALLBACK

Nếu logo lỗi hoặc chưa có:

```text
CHÂU TUẤN
```

hoặc app icon mặc định.

Không để broken image.

---

# 8. LOGO USAGE

Branding phải tự áp dụng ở:

- desktop sidebar
- mobile header
- login page
- favicon
- loading/splash nhẹ nếu có
- future PDF template
- future Excel header nếu report engine cần
- future email notification

Không duplicate logo config ở nhiều nơi.

Một branding source of truth.

---

# 9. PRIMARY COLOR

Admin có thể chọn primary brand color.

Nhưng không cho nhập CSS tùy ý không kiểm soát.

Có thể:

- color picker
- preset
- hex validated

Ví dụ:

```text
Primary brand color
#0F5EA8
```

Hệ thống phải tự derive safe tokens:

```text
primary
primary-hover
primary-active
primary-subtle
primary-border
focus-ring
```

Không yêu cầu admin tự nhập 10 màu.

---

# 10. COLOR SAFETY

Sau khi chọn primary color:

- kiểm tra contrast
- không cho màu quá nhạt làm button không đọc được
- tự chọn foreground trắng/đen phù hợp
- preview trước khi publish
- warning nếu accessibility thấp

Không để admin làm text invisible.

---

# 11. APPEARANCE SETTINGS

Trang:

```text
/system-admin/appearance
```

Cho phép cấu hình an toàn:

```text
Primary color
UI density
Sidebar behavior
Table density default
Default page size
Default appearance mode nếu project hỗ trợ
```

Ví dụ UI density:

```text
Thoải mái
Tiêu chuẩn
Gọn
```

Không cho nhập pixel thủ công.

---

# 12. DARK MODE

Chỉ triển khai nếu design system hiện tại đã support tốt.

Nếu chưa support tốt:

- không tự thêm dark mode nửa vời
- có thể để extension point

Nếu support:

```text
System
Light
Dark
```

Nhưng enterprise internal software V1 có thể chỉ cần Light.

---

# 13. FONT

Không cho admin upload font tùy ý ở V1.

Dùng font hệ thống/design system đã duyệt.

Có thể cho chọn giữa một vài font đã support nếu thật sự cần.

Ví dụ:

```text
Inter
Be Vietnam Pro
System
```

Không cho custom font phá tiếng Việt.

---

# 14. LOGIN PAGE BRANDING

Admin có thể chỉnh các nội dung an toàn:

```text
Logo
Tên hệ thống
Tên công ty
Subtitle ngắn
```

Ví dụ:

```text
Hệ thống nội bộ Châu Tuấn
Quản lý nhân sự, công trường và vận hành
```

Không xây login-page website builder.

Không gradient/hero marketing.

---

# 15. NAVIGATION SETTINGS

Trang:

```text
/system-admin/navigation
```

Cho phép:

- xem cấu trúc menu
- reorder trong giới hạn
- bật/tắt hiển thị module ở cấp tổ chức
- chọn default landing page phù hợp
- collapse/expand group mặc định nếu cần

Không được:

- sửa route path tùy ý
- nhập URL code
- tạo menu chạy arbitrary script
- bypass permission

---

# 16. MODULE VISIBILITY VS PERMISSION

Phải phân biệt:

```text
Module enabled
```

và:

```text
User has permission
```

Ví dụ:

```text
Kho = Enabled
User A không có warehouse.view
→ không thấy Kho
```

Nếu:

```text
Kho = Disabled toàn hệ thống
```

thì mọi user không dùng module đó dù có permission cũ.

Permission vẫn không bị xóa.

---

# 17. MODULE MANAGEMENT

Trang:

```text
/system-admin/modules
```

Hiển thị:

```text
Nhân sự           Enabled
Chấm công         Enabled
Dự án             Enabled
Kho               Disabled
Xuất nhập khẩu    Disabled
```

Cho phép bật module sau khi đã triển khai.

Không hiển thị feature chưa code như một module hoạt động.

Có thể dùng feature flags có schema rõ.

---

# 18. FEATURE FLAGS

Tạo feature flag foundation.

Ví dụ tương lai:

```text
attendance.offline_mode
attendance.photo_required
projects.daily_updates
warehouse.barcode
reports.custom_templates
```

Nhưng prompt này không tự tạo hàng loạt flag chưa có business rule.

Chỉ xây foundation an toàn.

---

# 19. ORGANIZATION SETTINGS

Trang:

```text
/system-admin/organization
```

Cho phép chỉnh:

```text
Tên công ty
Tên viết tắt
Địa chỉ
Số điện thoại
Email
Mã số thuế nếu cần cho văn bản
Thông tin đại diện nếu cần
```

Thông tin này có thể được sử dụng sau cho:

- PDF đơn nghỉ
- báo cáo
- Excel
- email
- văn bản nội bộ

Không duplicate ở từng module.

---

# 20. LOCALIZATION / TIME SETTINGS

Trang:

```text
/system-admin/localization
```

Cho phép:

```text
Timezone
Định dạng ngày
Định dạng giờ
Ngày đầu tuần
Ngôn ngữ mặc định nếu support
```

Default:

```text
Timezone: Asia/Ho_Chi_Minh
Date: DD/MM/YYYY
Time: HH:mm
Week start: Monday
```

Không để user thay timezone làm dữ liệu lịch sử sai.

Timezone chỉ ảnh hưởng presentation và business interpretation theo rule rõ.

---

# 21. UI DEFAULTS

Cho phép admin cấu hình một số default không nguy hiểm:

```text
Số dòng bảng mặc định
10 / 20 / 50 / 100

Mật độ bảng
Compact / Standard

Sidebar
Expanded / Collapsed

Default landing page
Dashboard / My Work / Attendance
```

Default landing page phải tôn trọng permission.

Nếu user không có quyền route đó, fallback route hợp lệ.

---

# 22. KHÔNG CHO CUSTOM TỰ DO CÁC THỨ SAU

V1 không cho admin:

- viết CSS
- viết JS
- chèn HTML raw
- sửa route
- sửa component layout
- drag-drop toàn bộ page
- đổi database schema
- sửa API endpoint
- sửa authentication code
- sửa business logic cốt lõi
- chỉnh permission bằng code
- upload arbitrary executable file

---

# 23. CUSTOM FIELD — CHỈ PREPARE

Sau này có thể cần:

```text
Nhân viên
+ Size áo bảo hộ
```

Prompt này chỉ chuẩn bị extension point.

Không implement full custom-field builder nếu chưa có prompt riêng.

Có thể hiển thị:

```text
Trường tùy chỉnh
Sắp có / chưa kích hoạt
```

hoặc không hiển thị gì nếu chưa cần.

---

# 24. PREVIEW MODE

Mọi thay đổi branding/appearance nên có:

```text
[Preview]
```

Preview phải không ảnh hưởng user khác.

Ví dụ:

- logo
- primary color
- sidebar
- login branding

---

# 25. DRAFT / PUBLISH

Nếu complexity hợp lý, dùng workflow:

```text
Draft
→ Preview
→ Publish
```

Nếu project nhỏ, có thể dùng:

```text
Preview
→ Save
```

Nhưng thay đổi quan trọng phải có confirm.

---

# 26. REVERT / VERSION HISTORY

Lưu lịch sử cấu hình.

Ví dụ:

```text
09/09/2026 14:20
Primary color
#005AAA → #114F8B

Người thay đổi:
Admin A
```

Cho phép revert version branding/appearance gần nhất khi an toàn.

Không revert security config mù quáng.

---

# 27. RESET TO DEFAULT

Có action:

```text
Khôi phục mặc định
```

Phải confirm.

Không xóa file/logo cũ trước khi save thành công nếu còn có thể rollback.

---

# 28. AUDIT LOG

Các action phải audit:

```text
upload logo
replace logo
change primary color
change organization info
enable/disable module
change navigation order
change UI defaults
publish settings
restore settings
```

Audit:

```text
actor
action
timestamp
before
after
```

---

# 29. PERMISSIONS

Tạo permission rõ.

Ví dụ:

```text
system_admin.access

branding.view
branding.manage

appearance.view
appearance.manage

navigation.manage
module.manage

organization_settings.view
organization_settings.manage

localization.manage

config_history.view
config_history.restore
```

Không hard-code:

```ts
role === "Admin"
```

---

# 30. SECURITY

Settings API phải server-side authorize.

Không dựa vào việc hide menu.

Không để client sửa key không có trong schema.

Whitelisted settings only.

Không generic API kiểu:

```text
POST /settings
{ arbitrary_key, arbitrary_value }
```

mà không validation.

---

# 31. SETTINGS SCHEMA

Mọi group settings phải có schema typed.

Ví dụ conceptual:

```text
BrandingSettings
AppearanceSettings
OrganizationSettings
LocalizationSettings
NavigationSettings
ModuleSettings
```

Validate server-side.

Unknown key bị reject.

---

# 32. DATABASE DESIGN

Có thể dùng:

```text
system_settings
settings_versions
brand_assets
feature_flags
navigation_config
```

hoặc typed tables phù hợp.

JSONB có thể dùng cho settings document nếu:

- schema validation nghiêm
- versioning
- typed DTO
- không biến thành arbitrary config dump

Không hard-code config chỉ trong frontend.

---

# 33. CACHE

Settings đọc thường xuyên nên có cache hợp lý.

Khi publish:

```text
update DB
→ invalidate cache
→ new config available
```

Không bắt redeploy.

Không cần realtime phức tạp nếu refresh đủ.

Nếu app hỗ trợ, có thể refresh theme config nhẹ.

---

# 34. BOOTSTRAP CONFIG

Khi app load:

- tải branding/theme config hiệu quả
- tránh flash màu/logo sai
- có fallback default
- lỗi settings không được làm app crash

Nếu config API lỗi:

```text
use safe default theme
```

---

# 35. BRAND ASSET STORAGE

Logo/favicons:

- không cần private như CCCD nếu chỉ là branding public nội bộ
- nhưng vẫn quản lý file an toàn
- validate MIME
- validate size
- không cho SVG script
- sanitize SVG nếu cho phép SVG

---

# 36. FAVICON UPDATE

Sau publish favicon:

- browser dùng file mới
- handle cache busting/versioned URL

Không hard-code `/favicon.ico` duy nhất nếu admin thay được.

---

# 37. APP TITLE

Browser title có format từ config.

Ví dụ:

```text
Nhân viên | Hệ thống nội bộ Châu Tuấn
```

Không hard-code tên app ở hàng chục page.

---

# 38. REPORT BRANDING FOUNDATION

Prompt này không xây PDF/Excel.

Nhưng branding config phải expose được:

```text
company_name
logo
address
phone
email
tax_code
```

để report engine sau này dùng.

Không để report engine phải tự hỏi lại từng module.

---

# 39. MOBILE BRANDING

Mobile:

- logo compact phù hợp
- không dùng logo ngang quá lớn
- header không cao
- app name có thể ẩn nếu logo đủ rõ
- fallback text nếu logo lỗi

---

# 40. ADMIN CONSOLE MOBILE

Admin Console ưu tiên desktop.

Mobile chỉ cần:

- xem
- chỉnh cấu hình đơn giản
- không cần tối ưu full configuration workflow nếu quá phức tạp

Không tạo UI quá dày trên điện thoại.

---

# 41. ADMIN CONSOLE UX

Mỗi settings page:

```text
Title
Description

Settings form

Preview nếu có

Save / Publish
```

Có sticky save bar nếu form dài.

Không dùng một page settings dài 5000px.

---

# 42. UNSAVED CHANGES

Nếu user thay đổi nhưng chưa save rồi chuyển route:

```text
Bạn có thay đổi chưa lưu.
```

Cho:

```text
Ở lại
Rời trang
```

Không spam nếu không có thay đổi.

---

# 43. SAVE FEEDBACK

Sau save:

```text
Đã cập nhật cấu hình.
```

Nếu cần reload:

```text
Thay đổi sẽ áp dụng sau khi tải lại trang.
```

Nếu có thể apply live, update ngay.

---

# 44. PREVIEW COMPONENT

Tạo preview nhỏ cho:

```text
Sidebar
Primary button
Status badge
Login branding
Mobile header
```

Không cần dựng full app preview trong iframe nếu quá nặng.

---

# 45. UI DENSITY PREVIEW

Ví dụ:

```text
Thoải mái
Tiêu chuẩn
Gọn
```

Cho preview DataTable row.

---

# 46. COLOR PREVIEW

Hiển thị:

```text
Primary button
Link
Active sidebar
Focus ring
Selected row
```

để admin thấy ảnh hưởng.

---

# 47. NAVIGATION REORDER

Nếu cho reorder:

- drag-and-drop accessible
- hoặc move up/down
- chỉ reorder trong allowed group
- không kéo item sang group vô lý nếu business không support

Không thay đổi route.

---

# 48. MODULE DISABLE CONFIRMATION

Nếu disable module đang dùng:

```text
Bạn đang tắt module Kho.
Người dùng sẽ không thể truy cập module này.
Dữ liệu không bị xóa.
```

Confirm.

Không drop table.

Không delete data.

---

# 49. CONFIGURATION OVER HARD-CODE

Tất cả thành phần frontend phải đọc từ configuration source thay vì:

```ts
const APP_NAME = "Châu Tuấn"
```

rải rác.

Tạo central access:

```text
useBranding()
useAppearance()
useOrganizationSettings()
```

hoặc pattern tương đương.

---

# 50. ROLE VS ADMIN CONSOLE

Trong UI/architecture phải giải thích rõ:

```text
Admin Console is a product area.
Permissions decide who can access it.
```

Không tạo special auth bypass cho Admin Console.

---

# 51. DEFAULT ADMIN EXPERIENCE

User có permission quản trị sẽ thấy:

```text
Trung tâm quản trị
```

trong sidebar hoặc user menu.

Không nhất thiết mọi user thấy.

---

# 52. TEST CASES

Bắt buộc test:

### Branding

- upload logo valid
- reject invalid file
- replace logo
- fallback logo
- favicon change
- app name change

### Appearance

- primary color change
- contrast safe
- density change
- preview
- save

### Permissions

- no permission → cannot access route
- direct URL access denied
- API deny
- manage permission → save allowed

### Module

- disable module
- menu disappears
- direct route blocked/fallback
- data remains
- enable module returns

### Config history

- change recorded
- audit recorded
- revert supported setting
- invalid config rejected

### Resilience

- config API fails → safe defaults
- bad logo URL → fallback
- malformed stored setting → do not crash

---

# 53. ACCEPTANCE CRITERIA

## Admin Console

- [ ] Có route riêng.
- [ ] Không nhầm với Admin role.
- [ ] Permission bảo vệ route/API.
- [ ] Settings chia page rõ.

## Branding

- [ ] Chỉnh được tên app.
- [ ] Chỉnh được tên công ty.
- [ ] Upload logo.
- [ ] Upload favicon.
- [ ] Preview.
- [ ] Fallback.

## Appearance

- [ ] Chỉnh primary color an toàn.
- [ ] Không raw CSS.
- [ ] UI density.
- [ ] Design tokens cập nhật nhất quán.

## Navigation / Module

- [ ] Module enable/disable không xóa data.
- [ ] Permission vẫn riêng biệt.
- [ ] Navigation không bypass permission.
- [ ] Không sửa route tùy ý.

## Config

- [ ] Server-side validation.
- [ ] Typed schema.
- [ ] Audit.
- [ ] Config history.
- [ ] Safe fallback.
- [ ] Không cần redeploy cho config được hỗ trợ.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Production build pass.

---

# 54. THỨ TỰ TRIỂN KHAI

1. Inspect settings/design-token foundation hiện tại.
2. Xác định config hiện đang hard-code.
3. Thiết kế typed settings schema.
4. Thiết kế storage/migration.
5. Thiết kế permission.
6. Xây Admin Console shell.
7. Branding page.
8. Appearance page.
9. Organization page.
10. Localization page.
11. Navigation/module page.
12. Preview.
13. Publish/save.
14. Config versioning.
15. Audit.
16. Safe fallback.
17. Responsive/accessibility.
18. Tests.
19. Lint/typecheck/build.
20. Báo cáo.

---

# 55. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Routes

Liệt kê Admin Console routes.

## Settings schemas

Liệt kê group settings.

## Database

Liệt kê migration/tables.

## Permissions

Liệt kê permission keys.

## Branding

Logo/favicon/theme được apply ở đâu.

## Config behavior

Preview/save/publish/revert.

## Tests

Các test đã chạy.

## Known limitations

Chỉ ghi limitation thật.

---

# 56. QUY TẮC CUỐI

Mục tiêu của Admin Console là:

> Cho phép người quản trị Châu Tuấn tự điều chỉnh các cấu hình vận hành và giao diện an toàn mà không cần mở source code.

Không biến nó thành:

> một website builder không giới hạn.

Không raw CSS.

Không raw JavaScript.

Không arbitrary HTML.

Không sửa route.

Không sửa business logic cốt lõi.

Không bypass permission.

Không hard-code branding.

**Dừng sau khi Admin Console + Branding + Appearance + Module/Navigation Configuration hoàn chỉnh, test/build pass và báo cáo kết quả.**
