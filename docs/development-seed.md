# Dữ liệu phát triển và kiểm thử

Hướng dẫn đầy đủ: [DEV/STAGING và kiểm thử](testing/DEV_STAGING_TESTING.md).

Ngày 08/10/2026 đã provision Supabase test riêng `CT_NoiBo_Test`, ref `lgmlkagcytfjazulgfbz`, tổ chức `jdfobdsnqqpyqfgbveke`, gói Free, Singapore (`ap-southeast-1`), `ACTIVE_HEALTHY`. Đã áp dụng 39 migration và SQL seed, chạy bootstrap lại với checksum migration/SKIP/audit tồn kho PASS, chạy seed lặp lại exit code 0 và verify trên Auth/database/storage thật. Business E2E ngày 09/10 `20261009ec2c4f` đạt **243 PASS, 0 FAIL, 0 BLOCKED**, gồm SETUP/SEAL. Staging HTTPS chưa deploy và Docker chưa có. Xem [kết quả và giới hạn](testing/RESULTS_2026-10-08.md).

## Bộ dữ liệu

- `supabase/seed.sql`: dữ liệu liên kết HR, công, phép, dự án, kho, XNK, lương, chat và thông báo nội bộ.
- `scripts/seed-test-users.mjs`: 50 nhân viên/tài khoản `test.user01`–`test.user50`, lịch sử công, hợp đồng, phép và phiếu lương. `test.user01` có quyền Kế toán; không có quyền Admin.
- `scripts/testing/accounts.mjs`: 10 tài khoản QA theo vai trò thực tế, gồm hai kỹ sư có phạm vi khác nhau.
- `scripts/testing/projects.mjs`: hai gói đang thực hiện, một gói hoàn thành, phân công công nhân, tiến độ, báo cáo, ảnh PNG và vướng mắc.
- `scripts/testing/personal.mjs`: dữ liệu cá nhân cho tài khoản QA gồm công, hợp đồng, lương và phiếu lương.
- `scripts/testing/assets.mjs`: ảnh hiện trường minh họa và bốn PDF XNK hư cấu trong private storage.

Dữ liệu được sinh giả lập. Nhận biết bằng `TEST-`, `QA_`, `[TEST]`, `metadata.testData` hoặc `metadata.testOwner`; ảnh/PDF có nhãn hư cấu. Không sao chép database production.

## Dùng môi trường đã provision

Project Free hiện tại đã có migration/SQL seed; không cần tạo lại project hoặc nạp SQL thủ công. App chạy tại `http://localhost:3300`. Provision ban đầu với `plan/create --confirm-create=CT_NoiBo_Test/status/configure` được ghi trong [hướng dẫn remote](testing/DEV_STAGING_TESTING.md#21-database-test-remote-app-chạy-local); các script cố định tổ chức/tên/vùng, kiểm tra quota Free, manifest owner và ref khác production, không nâng gói hoặc chọn tài nguyên trả phí.

```powershell
$env:TEST_ENV_FILE='.env.e2e.local'
node scripts/testing/provision-remote.mjs status
node scripts/testing/provision-remote.mjs configure
npm run test:config:init
npm run test:config:check
node scripts/testing/bootstrap-remote.mjs --confirm-project=lgmlkagcytfjazulgfbz
npm run test:environment:init -- --confirm-project=lgmlkagcytfjazulgfbz
npm run test:seed
npm run test:seed:verify
```

`configure` kiểm tra project `ACTIVE_HEALTHY`, lấy publishable/secret keys của project test và ghi thẳng vào env riêng; không in key, token hoặc database password. `.env.e2e.local` hiện dùng `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` và `SUPABASE_SECRET_KEY` của test; legacy anon/service-role aliases để trống. Ba URL Supabase cùng `https://lgmlkagcytfjazulgfbz.supabase.co`, `TEST_SUPABASE_PROJECT_ID=lgmlkagcytfjazulgfbz`. Giữ `APP_ENV=test`, `RELEASE_ENVIRONMENT=test`, `TEST_TOOLS_ENABLED=true`, `E2E_DATABASE_KIND=test`; `APP_BASE_URL` và `E2E_BASE_URL` cùng `http://localhost:3300`.

`test:config:init` chỉ sinh secrets local/bổ sung alias còn trống và ghi file cấu hình; giữ giá trị đã có, không tự tạo project hoặc kết nối DB. Khi URL/keys còn trống, file vẫn được ghi nhưng lệnh trả exit code 1 và liệt kê biến cần điền. `test:config:check` chỉ kiểm tra file local, không chứng minh migration/marker. Thiếu cấu hình sẽ báo tên file/tên biến và dừng trước DB, không in secrets.

Bootstrap chỉ chấp nhận project test do manifest quản lý, tổ chức Free, trạng thái healthy và xác nhận ref khớp target. Migration đã áp dụng có checksum SHA256; chạy lại bỏ qua migration/SQL seed đã ghi, giữ chứng từ và audit tồn kho khớp ledger. Manifest `test-results/provisioning/CT_NoiBo_Test.private.json` có owner và database password, được Git bỏ qua; không in/commit/upload public. Không sao chép production credentials hoặc backup production.

Dữ liệu đã verify trên project thật:

| Fixture | Kết quả ngày 08/10/2026 |
|---|---|
| QA accounts | 10 tài khoản có Auth linkage/role đúng và đang active |
| Cohort `test.user01`–`test.user50` | 50 nhân viên, hợp đồng, lương, timesheet summaries, payroll lines và payslips |
| Attendance / leave | 1.992 attendance, 25 leave |
| QA projects | Hai dự án, scope kỹ sư riêng được verify |
| Storage | Hai PNG + bốn PDF, download/checksum/magic bytes/visibility private PASS |

Fixture verify không thay thế đối soát nghiệp vụ E2E. Build test production webpack đã PASS với 281 static pages; full E2E có báo cáo riêng.

Terminal 1 build và chạy app test local:

```powershell
$env:TEST_ENV_FILE='.env.e2e.local'
npm run e2e:build
npm run e2e:start
```

Terminal 2 dùng cùng file để chạy nghiệp vụ E2E:

```powershell
$env:TEST_ENV_FILE='.env.e2e.local'
npm run test:e2e:business
```

Với Docker local tùy chọn, chạy `test:local:start` trước và dùng URL/keys local; ref xác nhận trong lệnh init là `local`. Các lệnh test chỉ nhận `.env.e2e.local`, `.env.staging.local` hoặc `.env.development.local` tại gốc workspace; không chọn `.env.local` làm file test. Mật khẩu lấy từ `TEST_ACCOUNT_PASSWORD`; không có mật khẩu mặc định trong script. Secrets nằm trong env được Git bỏ qua. Website staging dùng env/secrets và HTTPS riêng theo [hướng dẫn](testing/DEV_STAGING_TESTING.md#22-website-staging-được-deploy), hiện còn chờ hosting/domain.

## Chạy lại và reset

```powershell
npm run test:accounts:seed
npm run test:accounts:verify
npm run test:seed
npm run test:seed:verify
npm run test:reset -- --confirm-project=lgmlkagcytfjazulgfbz
```

`test:reset` khôi phục tài khoản QA/phân công; giữ chứng từ, ledger, audit và hồ sơ lịch sử. Lệnh không xóa sạch nghiệp vụ. Mật khẩu/trạng thái/quyền QA được sửa và phiên cũ bị thu hồi.

Muốn database sạch, chỉ reset Docker project riêng:

```powershell
$env:TEST_ENV_FILE='.env.development.local'
npm run test:config:check
if ($LASTEXITCODE -ne 0) { throw 'Cần cấu hình Docker local riêng trước khi reset' }
node --input-type=module -e "import { loadTestConfiguration } from './scripts/testing/config.mjs'; const { target } = await loadTestConfiguration(); if (target.projectId !== 'local') throw new Error('Reset cần cấu hình Supabase Docker local');"
if ($LASTEXITCODE -ne 0) { throw 'File đang trỏ database khác Docker local' }
npm run test:local:reset -- --confirm-local=CT_NoiBo_Test
```

Sau reset sạch, init marker và `test:seed` lại theo [khối lệnh Docker có kiểm tra lỗi](testing/DEV_STAGING_TESTING.md#4-seed-và-reset). Dùng `.env.development.local` với URL/key Docker và `TEST_SUPABASE_PROJECT_ID=local`; không dùng env cloud hiện tại. Nếu dùng anon/service-role local, để trống publishable/secret aliases. Các lệnh `seed:*:reset` cũ bị chặn trước truy cập DB. Không dùng `supabase/reset-test-data.sql` để dọn E2E: stock ledger/audit có trigger bất biến.

UUID cố định tránh bản ghi trùng. Seed đã chạy lặp lại thành công; stock ledger/audit giữ lịch sử append-only và chứng từ đã ghi sổ được giữ lại. Bootstrap đã audit tồn kho mẫu khớp ledger; một số fixture công/lương ban đầu vẫn là snapshot để kiểm tra màn hình. E2E riêng thực hiện nghiệp vụ qua API và đối soát dữ liệu mới. Chạy lại seed có thể sửa trường quản lý fixture; không coi seed là reset sạch hoặc cơ chế phục hồi toàn bộ lịch sử vận hành.

Server/script kiểm tra môi trường, URL, project ID, marker DB và secrets riêng. `--allow-remote` không mở được production. Account có marker test bị chặn đăng nhập và resolve session trên production.

Xem [kết quả thực tế](testing/RESULTS_2026-10-08.md) trước khi coi việc nạp dữ liệu hoặc E2E đã thành công.
