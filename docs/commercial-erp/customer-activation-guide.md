# Kích hoạt cấu hình doanh nghiệp

## Phạm vi

`scripts/database/activation.mjs` chuyển manifest đã review thành bốn nhóm settings: thương hiệu, tổ chức, bản địa hóa và module. Mặc định script chỉ tạo preview local. Chế độ prepare chỉ đọc database và ghi một file plan trong `.tmp`; chế độ apply thực hiện một RPC nguyên tử khi operator truyền rõ plan và SHA-256 đã duyệt.

Đây là bước cấu hình trong bộ cài riêng cho từng doanh nghiệp. Script không tạo Supabase project, không chạy migration, không tạo tài khoản admin, không đổi mật khẩu, không ghi dữ liệu nghiệp vụ và không phát hành ứng dụng. Việc chuyển cả bộ cài sang production vẫn cần rehearsal, backup, kiểm tra quyền, nghiệm thu nghiệp vụ và phê duyệt phát hành.

## Điều kiện trước prepare/apply

- Manifest v1 hợp lệ, chỉ tới project riêng của doanh nghiệp. Hai project cũ được bảo vệ trong validator không thể dùng làm target.
- File môi trường `.env*.local` riêng tại gốc workspace, có URL và secret key đúng target. Activation luôn yêu cầu tên file rõ ràng; không mượn key từ process hay bản cài DTech.
- Migration `202610210002_atomic_system_settings.sql` đã được triển khai theo runbook. Prepare chỉ kiểm tra có thể đọc schema receipt; đó không phải bằng chứng migration đã được nghiệm thu.
- Có đủ bốn hàng `branding`, `organization`, `localization`, `modules` trong `system_settings`, mỗi hàng có snapshot hợp lệ và version dương. Thiếu hàng hoặc dữ liệu sai schema phải được xử lý trước, không tự điền cả nhóm bằng mặc định.
- Actor ID là UUID của app account đang hoạt động, có `system_admin.access` và quyền quản lý từng nhóm. Database kiểm tra lại actor và quyền trong transaction; UUID truyền cho prepare không tự chứng minh actor được cấp quyền.

Không lưu secret trong manifest hoặc activation plan. Plan chứa snapshot cấu hình doanh nghiệp, gồm thông tin tổ chức và URL tài sản đã lưu; chỉ lưu tại `.tmp` được Git bỏ qua và bảo vệ theo quy định nội bộ.

## Thiết lập trong ứng dụng

Vào **Thiết lập ERP** tại `/system-admin/setup`; cần đủ quyền quản lý thương hiệu, tổ chức, định dạng, module và truy cập quản trị. Thực hiện bốn bước rồi xác nhận xuất bản. Các trường không sửa được giữ nguyên. Nếu baseline đã cũ, tải lại theo xác nhận của người quản trị; không sửa expected version để ép lưu.

**Lưu bản nháp** chỉ lưu trên trình duyệt đang dùng, theo account/app/Supabase origin; không lưu secrets, nhưng có thông tin liên hệ doanh nghiệp. **Tiếp tục bản nháp** giữ baseline và request ID trước đó. **Bỏ bản nháp** xóa bản lưu trên trình duyệt sau khi tải cấu hình server thành công. Pending command được lưu trước POST để reload/retry không tạo command mới. Browser không lưu được thì không gửi POST. Không có đồng bộ bản nháp liên thiết bị hoặc server onboarding state.

Migration chưa sẵn sàng thì nút xuất bản bị khóa. API không dùng fallback hiển thị để ghi hoặc cấp quyền. Sau migration, trang chỉnh từng nhóm cũng dùng RPC nguyên tử; chỉ tương thích luồng cũ khi cả RPC và bảng receipt được xác nhận chưa tồn tại. Lỗi mạng hoặc rollout hỏng không chuyển sang ghi tách rời. Các form chỉnh từng nhóm cũ vẫn đọc version tại lúc submit; chúng chưa mang baseline của lần mở form như wizard/CLI.

## 1. Preview local

```powershell
node scripts/database/activation.mjs
node scripts/database/activation.mjs --manifest=supabase/deployments/customer.example.json --environment-file=.env.customer.local
```

Hai lệnh trên không mở file môi trường và không gọi Supabase. Kết quả có `dryRun: true`, `networkAccess: false`, fingerprint của manifest và các field dự kiến thay đổi. File `customer.example.json` chỉ chứa target minh họa.

Manifest sở hữu các field sau:

| Nhóm | Field áp dụng từ manifest |
| --- | --- |
| `branding` | `systemName` |
| `organization` | `companyName`, `shortName` |
| `localization` | `timezone`, `locale` |
| `modules` | Toàn bộ chín cờ module và `industryPreset` |

Các field còn lại được lấy từ snapshot đang lưu, bao gồm logo, phụ đề đăng nhập, địa chỉ, điện thoại, thông tin thuế và định dạng ngày. Operator phải xem lại chúng khi chuyển thương hiệu. Ba cờ module cũ `accounting`, `operations`, `messaging` nếu chưa có thì dùng đúng ngữ nghĩa tương thích hiện hành là `true` khi đọc snapshot trước thay đổi; giá trị `false` đã lưu được giữ trong snapshot đối chiếu. Snapshot sau kích hoạt luôn có đủ chín cờ rõ ràng theo manifest, kể cả `false` cho module không chọn.

## 2. Prepare từ cấu hình hiện tại

Lệnh sau chỉ là mẫu cho target minh họa. Thay manifest, file môi trường, project ref và actor bằng thông tin đã review của bản cài thật trước khi operator chủ động chạy.

```powershell
node scripts/database/activation.mjs --prepare --manifest=supabase/deployments/customer.example.json --environment-file=.env.customer.local --project-ref=abcdefghijklmnopqrst --actor-id=11111111-1111-4111-8111-111111111111 --output=.tmp/customer-activation/review-001.json
```

Prepare kiểm tra target, đọc schema receipt và bốn nhóm settings, hợp nhất các field manifest rồi kiểm tra bằng cùng Zod schema với ứng dụng. Kết quả ghi ra file mới; không ghi đè file đã tồn tại. Stdout chỉ có đường dẫn plan, project ref, request ID, expected versions và SHA-256, không in key hoặc toàn bộ snapshot.

Plan lưu cố định:

- Manifest path/fingerprint, deployment ID, project ref/API URL và tên file môi trường.
- Actor ID và request ID UUID. Có thể truyền `--request-id=<UUID>` khi prepare; nếu bỏ qua thì tạo một lần tại bước prepare.
- Snapshot hoàn chỉnh sau hợp nhất, expected version của từng nhóm và fingerprint của cấu hình trước thay đổi.
- Phiên bản hợp đồng plan/command.

Mở file plan local để review toàn bộ snapshot và ghi nhận SHA-256 từ kết quả prepare. SHA-256 dùng để gắn approval với đúng nội dung review, không phải chữ ký hoặc chứng minh quyền sở hữu database. Operator có secret key và quyền admin vẫn là bên được tin cậy.

## 3. Apply đúng plan đã review

Thay giá trị SHA trong lệnh bằng đúng 64 ký tự hex của prepare. Chuỗi minh họa bên dưới sẽ bị từ chối.

```powershell
node scripts/database/activation.mjs --apply --manifest=supabase/deployments/customer.example.json --environment-file=.env.customer.local --project-ref=abcdefghijklmnopqrst --plan=.tmp/customer-activation/review-001.json --confirm-plan=SHA256_DA_DUYET
```

Apply kiểm tra schema, hash, target, manifest, tên file môi trường và các field do manifest sở hữu trước khi mở secret file. Sau đó chỉ gọi `publish_system_settings_command` một lần với actor, request ID và expected versions trong plan. Không có chuỗi upsert riêng cho từng nhóm.

Database kiểm tra quyền actor, khóa transaction, đối chiếu mọi expected version, ghi settings, lịch sử, audit và receipt cùng transaction. Nếu một version đã thay đổi thì toàn bộ command bị từ chối. Cùng request ID và cùng payload được nhận lại receipt cũ; cùng request ID nhưng payload hoặc actor khác bị từ chối. Anonymous và tài khoản authenticated thông thường không được gọi trực tiếp command.

Kết quả `applied: true` chỉ được trả khi receipt có đúng request ID và cả bốn version bằng expected version cộng một. Bước xác minh sau kích hoạt cần đối chiếu settings, đăng nhập, module được bật/tắt và thương hiệu trên chính bản cài đã review. Cache cấu hình đang dùng có thể còn giữ snapshot trước đó tối đa theo TTL hiện hành; command CLI không tự xóa cache của process ứng dụng.

## Xử lý lỗi và retry

| Tình huống | Thao tác |
| --- | --- |
| Plan bị chỉnh sau review hoặc manifest đổi | Prepare file mới, review lại và dùng SHA mới |
| Version conflict do có người vừa chỉnh settings | Đọc trạng thái hiện tại, prepare lại; không đổi expected version thủ công trong plan cũ |
| RPC thiếu hoặc receipt schema không đọc được | Kiểm tra migration và quyền service role trong staging |
| Actor bị khóa hoặc thiếu quyền | Sửa quyền qua quy trình quản trị, sau đó đối chiếu lại plan |
| Timeout, lỗi mạng hoặc receipt chưa xác nhận | Giữ nguyên plan và request ID; đối chiếu receipt/trạng thái trước khi retry cùng plan |
| File plan đã tồn tại | Chọn tên file mới; script không ghi đè bản đã review |

Không tạo request ID mới chỉ vì kết quả mạng không chắc chắn. Không chỉnh hay xóa receipt để ép lệnh chạy lại. Thông báo CLI không đưa raw SDK error, environment values hoặc nội dung snapshot vào log.

## Bằng chứng phát triển

Kiểm thử tự động tại `scripts/database/activation.test.mjs` sử dụng client giả và secret tổng hợp, không đọc `.env` thật và không kết nối cloud. Chúng bao gồm preview không I/O kết nối, merge giữ tùy chỉnh, legacy flags, schema/version sai, ràng buộc target/hash, prepare chỉ đọc, một RPC apply, retry giữ request ID và che lỗi có chứa secret giả.

CLI hiện được kiểm tra bằng mock và preview local; chưa chạy prepare/apply CLI với database thật. Cùng RPC đã qua **56 kiểm tra PostgreSQL 17.10** trên cluster tạm, gồm hai connection, rollback, phân quyền và ACL receipt. Migration đã áp dụng vào DTech development (PostgreSQL 17.11); wizard publish/retry/conflict thực đã đạt, không đổi giá trị ngữ nghĩa cấu hình và không tạo chứng từ nghiệp vụ. Xem [integration](evidence/atomic-settings-integration.json), [rollout](evidence/activation-rollout.json) và [QA](evidence/qa-p2-activation.json).

Khi rollout một deployment khác, tạm dừng ghi cấu hình trong cửa sổ migration và cập nhật toàn bộ worker. Command bảo đảm CAS giữa writer mới; SQL/operator cũ ghi trực tiếp không tự tham gia giao thức idempotency. Không sửa hoặc xóa receipt để ép retry. Còn full-stack Supabase rehearsal, hai-instance isolation, backup/restore và business UAT trước phát hành thương mại.
