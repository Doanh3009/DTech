# DEV/STAGING và kiểm thử CT_NOIBO

## Trạng thái

Branch: `feat/dev-staging-test-platform`. Ngày 08/10/2026 đã tạo Supabase test độc lập `CT_NoiBo_Test`, ref `lgmlkagcytfjazulgfbz`, trong tổ chức `jdfobdsnqqpyqfgbveke`, gói **Free**, vùng Singapore (`ap-southeast-1`), trạng thái `ACTIVE_HEALTHY`. `.env.e2e.local` đã nhận publishable key và secret key của chính project test; không sử dụng credentials production.

Đã áp dụng 39 migration và SQL seed; bootstrap chạy lại bỏ qua migration/seed đã áp dụng, kiểm tra checksum migration và audit tồn kho thành công. `test:seed` chạy lặp lại exit code 0; account/fixture/private storage verify thành công. Build E2E bằng production webpack với cấu hình test thành công, sinh 281 static pages; app dùng `http://localhost:3300`. Business E2E ngày 09/10 `20261009ec2c4f` hoàn tất **243 PASS, 0 FAIL, 0 BLOCKED**, gồm SETUP/SEAL và thao tác qua switcher thu gọn. Docker chưa có và website staging HTTPS chưa deploy; hosting/domain còn chờ. Xem [kết quả và phạm vi kiểm thử](RESULTS_2026-10-08.md).

Authentication giữ nguyên Supabase Auth → `app_accounts` → `app_sessions` → RBAC. Quick Login dùng `signInWithPassword` hiện hữu, tạo phiên thật. Chuyển account thu hồi phiên QA cũ sau khi auth mới thành công và tải lại toàn trang.

| Môi trường | Website | Database | Truy cập test |
|---|---|---|---|
| DEV/TEST hiện tại | localhost:3300 | Supabase Free `lgmlkagcytfjazulgfbz` | Cổng tester |
| DEV Docker tùy chọn | localhost:3300 | Docker riêng :55321 | Cổng tester |
| STAGING chưa deploy | HTTPS riêng đang chờ hosting | Supabase test độc lập | HTTP Basic toàn app + cổng tester |
| PRODUCTION | Website vận hành | Production | Test API 404; test account bị chặn |

Build test dùng `.next-e2e`, review production dùng `.next-review`, server hiện tại giữ `.next`. Không dùng chung port/build directory.

Các lệnh test chỉ nhận `.env.e2e.local`, `.env.staging.local` hoặc `.env.development.local` tại gốc workspace qua `TEST_ENV_FILE`; mặc định là `.env.e2e.local`. Không chọn `.env.local` làm file test.

## 1. DEV với Docker local

Yêu cầu dependencies, Node theo package, Docker Desktop đang chạy, Chromium/Edge.

```powershell
$env:TEST_ENV_FILE='.env.development.local'
npm ci
npm run test:local:start
npm run test:local:status
npm run test:config:init
```

CLI tạo Docker project `CT_NoiBo_Test` tại `test-results/local-supabase/supabase`, port 553xx; `start` áp dụng migration/SQL seed khi khởi tạo DB mới. `status` có thể in keys: chỉ dùng trong env local, không đưa log vào chat/PR.

`local.mjs` tạo bản SQL seed dành riêng cho Docker bằng `local-seed.mjs`: kiểm tra danh tính/ownership trước và sau seed, gắn nhãn test cho đúng ba tài khoản demo đã xác minh, rồi sửa snapshot bốn kỳ công mẫu. Giữ nguyên seed/migration gốc và dữ liệu ngoài các ID được quản lý. Helper/orchestration đã qua 27 unit tests; chưa chạy Docker thực tế vì Docker CLI chưa có trong PATH trên máy hiện tại.

Điền `.env.development.local` riêng cho Docker; giữ `.env.e2e.local` hiện tại để dùng Supabase cloud. Dừng app test :3300 trước khi chạy app Docker từ cùng workspace; hai chế độ dùng cùng cổng và build directory.

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `TEST_SUPABASE_URL`, `E2E_SUPABASE_URL` | Cùng `http://127.0.0.1:55321` hoặc cùng `http://localhost:55321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key local |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key local |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Để trống khi dùng anon/service-role local; không giữ alias key cloud |
| `TEST_SUPABASE_PROJECT_ID` | `local` |
| `APP_ENV`, `RELEASE_ENVIRONMENT` | `development` |
| `TEST_TOOLS_ENABLED`, `E2E_DATABASE_KIND` | `true`, `test` |
| `APP_BASE_URL`, `E2E_BASE_URL` | `http://localhost:3300` |

`test:config:init` sinh password/gate/session secret riêng, giữ giá trị đã cấu hình, không in secrets và không tạo project Supabase. Nếu còn thiếu credentials, lệnh vẫn ghi file nhưng trả exit code 1 và liệt kê các biến cần điền. Sau khi điền URL/keys, chạy lại để bổ sung alias còn trống; sửa alias cũ nếu đổi target.

```powershell
$env:TEST_ENV_FILE='.env.development.local'
npm run test:config:init
if ($LASTEXITCODE -ne 0) { throw 'Điền URL và keys Docker local trước khi tiếp tục' }
npm run test:config:check
if ($LASTEXITCODE -ne 0) { throw 'Cấu hình Docker chưa hợp lệ' }
node --input-type=module -e "import { loadTestConfiguration } from './scripts/testing/config.mjs'; const { target } = await loadTestConfiguration(); if (target.projectId !== 'local') throw new Error('Setup cần cấu hình Supabase Docker local');"
if ($LASTEXITCODE -ne 0) { throw 'File đang trỏ database khác Docker local' }
npm run test:environment:init -- --confirm-project=local
if ($LASTEXITCODE -ne 0) { throw 'Marker Docker chưa khởi tạo thành công' }
npm run test:seed
if ($LASTEXITCODE -ne 0) { throw 'Docker seed chưa thành công' }
npm run test:seed:verify
if ($LASTEXITCODE -ne 0) { throw 'Dữ liệu Docker chưa verify thành công' }
npm run dev:test
```

Mở `http://localhost:3300/login`. Server :3000 không tự chuyển sang database test.

## 2. Supabase test remote và STAGING

### 2.1. Database test remote, app chạy local

Luồng hiện tại dùng project Free `CT_NoiBo_Test` đã tạo và website `http://localhost:3300`; không cần Docker. Website staging được deploy riêng ở mục 2.2. Khi dùng lại project hiện tại, không cần chạy lệnh `create`.

Các script `management.mjs`, `provision-remote.mjs` và `bootstrap-remote.mjs` dùng phiên Supabase CLI đã đăng nhập, hoặc `SUPABASE_ACCESS_TOKEN` được cấp riêng. Không in token, key hay database password. Provision cố định tên project, tổ chức và vùng nêu trên; chỉ chấp nhận tổ chức Free, kiểm tra hạn mức project trước khi tạo, không chọn compute/add-on trả phí. Manifest sở hữu nằm ở `test-results/provisioning/CT_NoiBo_Test.private.json`, được Git bỏ qua; file có database password nên phải lưu private và không đưa nội dung vào log/chat/PR.

**Dùng lại project đã provision:**

```powershell
$env:TEST_ENV_FILE='.env.e2e.local'
node scripts/testing/provision-remote.mjs plan
node scripts/testing/provision-remote.mjs status
node scripts/testing/provision-remote.mjs configure
npm run test:config:init
npm run test:config:check
node scripts/testing/bootstrap-remote.mjs --confirm-project=lgmlkagcytfjazulgfbz
npm run test:seed
npm run test:seed:verify
```

`plan` đọc tổ chức/gói và danh sách project; `status` đối chiếu project với manifest. `configure` chỉ lấy publishable/secret keys khi project `ACTIVE_HEALTHY`, ghi thẳng vào file test riêng và từ chối ghi đè file đang trỏ project khác. Manifest phải có owner đúng, tên/tổ chức đúng và ref khác production. Project hiện tại đã có marker; dùng lại không chạy `test:environment:init`. Init chỉ dùng lúc khởi tạo database mới sau audit tài khoản; lịch sử E2E không phải điều kiện để tự ghi lại marker. Không dùng `.env.local` làm file test hoặc chép production key vào file test.

**Lệnh tạo lần đầu đã dùng ngày 08/10/2026:**

```powershell
$env:TEST_ENV_FILE='.env.e2e.local'
npm run test:config:init
node scripts/testing/provision-remote.mjs plan
node scripts/testing/provision-remote.mjs create --confirm-create=CT_NoiBo_Test
node scripts/testing/provision-remote.mjs status
node scripts/testing/provision-remote.mjs configure
npm run test:config:init
npm run test:config:check
node scripts/testing/bootstrap-remote.mjs --confirm-project=lgmlkagcytfjazulgfbz
npm run test:environment:init -- --confirm-project=lgmlkagcytfjazulgfbz
npm run test:seed
npm run test:seed:verify
```

Lần đầu chưa có URL/keys, `test:config:init` vẫn tạo file và secrets local nhưng trả exit code 1, liệt kê biến còn thiếu. Provision `configure` bổ sung credentials của project mới; chỉ bootstrap sau khi `test:config:check` thành công. Nếu `status` chưa là `ACTIVE_HEALTHY`, chờ project sẵn sàng rồi chạy lại `status/configure`. `create` cần xác nhận tên rõ ràng, từ chối tạo khi hết quota Free hoặc khi có project cùng tên nhưng không có manifest sở hữu; script không tạo tổ chức tùy ý hoặc nâng gói.

Các giá trị hiện tại trong `.env.e2e.local`:

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `TEST_SUPABASE_URL`, `E2E_SUPABASE_URL` | `https://lgmlkagcytfjazulgfbz.supabase.co` |
| `TEST_SUPABASE_PROJECT_ID` | `lgmlkagcytfjazulgfbz` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key của project test, lưu private trong env |
| `SUPABASE_SECRET_KEY` | Secret key của cùng project test, lưu private trong env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Để trống; project hiện tại dùng publishable/secret keys |
| `APP_ENV`, `RELEASE_ENVIRONMENT` | `test` |
| `TEST_TOOLS_ENABLED`, `E2E_DATABASE_KIND` | `true`, `test` |
| `APP_BASE_URL`, `E2E_BASE_URL` | Cùng `http://localhost:3300` |

Ba URL Supabase phải trùng nhau và project ID phải khớp hostname. Init giữ nguyên giá trị đã có; nếu từng cấu hình project khác, sửa cả ba URL và project ID. `test:config:check` chỉ đọc/kiểm tra file local, không gửi request đến Supabase và không chứng minh database, migration, marker hoặc server đã sẵn sàng.

Bootstrap kiểm tra env/manifest/tổ chức Free/trạng thái project và yêu cầu `--confirm-project` khớp ref test. Guard đã có phải khớp owner/project trước mọi write; database chưa có guard chỉ được bootstrap nếu schema `public` không có bảng hoặc view. Migration được áp dụng theo thứ tự tên file, ghi SHA256 trong guard và từ chối nếu migration đã áp dụng bị sửa. SQL seed chỉ nạp một lần, kiểm checksum khi SKIP; chạy tiếp hoặc chạy lại giữ chứng từ đã có. Bootstrap đánh dấu tài khoản demo của project mới là test, sửa snapshot kỳ công đã khóa và kiểm tra `audit_inventory_balance(null)` khớp ledger. Không phục hồi backup production.

Init marker từ chối database có tài khoản không đánh dấu test. Marker không chứng minh lịch sử toàn DB; project hiện tại được tạo mới và audit qua bootstrap. Không cung cấp reset sạch remote.

Terminal 1 chạy app local bằng cấu hình test:

```powershell
$env:TEST_ENV_FILE='.env.e2e.local'
npm run e2e:build
npm run e2e:start
```

Mở terminal 2, chọn cùng file cấu hình rồi chạy nghiệp vụ:

```powershell
$env:TEST_ENV_FILE='.env.e2e.local'
npm run test:e2e:business
```

Mở `http://localhost:3300/login` để dùng cổng tester/Quick Login. Seed/account/storage verify đã thành công trên project thật; full E2E cần kết quả riêng trong [báo cáo](RESULTS_2026-10-08.md), không suy ra PASS từ build hoặc fixture verify.

### 2.2. Website STAGING được deploy

Website staging HTTPS chưa được triển khai. Khi có hosting/domain staging, chọn `.env.staging.local` và sinh secrets riêng; database test đã có là `CT_NoiBo_Test` với 39 migration và SQL seed, không cần tạo thêm project để dùng lại môi trường này:

```powershell
$env:TEST_ENV_FILE='.env.staging.local'
npm run test:config:init
```

Điền file staging giống local, với:

- `APP_ENV=staging`, `RELEASE_ENVIRONMENT=staging`.
- Ba URL Supabase cùng `https://lgmlkagcytfjazulgfbz.supabase.co`; `TEST_SUPABASE_PROJECT_ID=lgmlkagcytfjazulgfbz`.
- `APP_BASE_URL` và `E2E_BASE_URL` cùng HTTPS website staging.
- `STAGING_ACCESS_USER` riêng, `STAGING_ACCESS_PASSWORD` tối thiểu 16 ký tự.
- `PRODUCTION_SUPABASE_URL` tham chiếu production.
- `PRODUCTION_SERVICE_KEY_SHA256` và `PRODUCTION_SESSION_SECRET_SHA256` là fingerprints SHA256 của secrets production để đối chiếu; không chép chính secrets production vào staging.

Init config có thể lấy URL/fingerprints từ `.env.local`; cần xác nhận đó là môi trường muốn bảo vệ. Nếu thiếu tham chiếu production local, quản trị viên điền fingerprints qua secret manager. Service key/session secret staging bắt buộc khác production; gate khác password tài khoản và session secret.

Init cũng sinh `API_KEY_PEPPER`, `INTEGRATION_ENCRYPTION_KEY`, signing/worker/cron secrets riêng cho test. Wrapper xóa alias private chưa cấu hình để tránh Next nạp nhầm từ `.env.local`. Giữ các secrets này trong biến môi trường staging khi deploy.

```powershell
npm run test:config:init
npm run test:config:check
npm run test:seed
npm run test:seed:verify
```

Project hiện tại dùng lại marker đã có, khớp owner/URL/project ID; không chạy lại `test:environment:init` khi đổi app từ test sang staging trên cùng database test. Quy tắc marker và giới hạn reset remote giống mục 2.1. Cấu hình thiếu vẫn được ghi bởi init nhưng trả exit code 1; chỉ tiếp tục khi `test:config:check` thành công.

Deploy vào hosting/domain riêng với biến môi trường staging. Build: `npm run build:wasm`; start: `npm run start`. Giữ `E2E_DATABASE_KIND=test` ở build và runtime để dùng cùng `.next-e2e`. Hosting phải hỗ trợ Next.js proxy/HTTPS. Public Supabase URL/key được đóng vào client tại build; đổi target cần build lại. Không đưa env file vào Git/image build.

Website phải hỏi HTTP Basic trước app/API; giữ lớp server này kể cả khi hosting có protection riêng. Deployment thực tế còn chờ quyền/credentials/domain staging.

## 3. Tài khoản, quyền và Quick Login

| Username | Role/profile |
|---|---|
| `admin.test` | `admin` hiện hữu |
| `director.test` | `qa_director`, permission điều hành hiện hữu |
| `manager.test` | `qa_manager`, permission quản lý hiện hữu |
| `engineer.test`, `engineer02.test` | `supervisor`, công trường A và B riêng |
| `accountant.test` | `accountant` |
| `hr.test` | `hr` |
| `warehouse.test` | `qa_warehouse`, permission `warehouse.*` hiện hữu |
| `import.test` | `qa_import`, permission XNK và nhập kho được cấp |
| `employee.test` | `employee` |

Baseline chưa có role Director/Manager/Warehouse/Import độc lập. Seed tạo bốn profile QA `[TEST]`, `is_system=false` trong RBAC hiện tại; không tạo permission mới hoặc sửa role chuẩn. Cần người quản lý nghiệp vụ review profile trước khi coi là chuẩn quyền production.

Có thêm 50 `test.user01`–`test.user50` và 10 công nhân QA. Nhân viên thường mở phiếu lương trong **Cá nhân**.

```powershell
npm run test:accounts:seed
npm run test:accounts:verify
```

UUID/username ổn định; collision với dữ liệu không owned bị từ chối. Seed sửa password/trạng thái/quyền QA và thu hồi phiên cũ. Mật khẩu chỉ lấy từ `TEST_ACCOUNT_PASSWORD` trong env riêng.

Quick Login:

1. Nhập HTTP Basic nếu là staging.
2. Mở `/login`, nhập `TEST_TOOLS_GATE_SECRET` trong **Mã truy cập tester**.
3. Chọn nhãn tài khoản trong **TÀI KHOẢN KIỂM THỬ**.
4. Trong app, dùng **Đang kiểm thử** để chuyển tài khoản, trang tải lại với session mới.

Grant tester HttpOnly/SameSite Strict tối đa 8 giờ, HMAC theo target/môi trường. Cookie app có hậu tố `_development`, `_test`, `_staging`; production giữ tên cũ. Chỉ allowlist account có đúng metadata/target/Auth/employee được chọn. Không thay phiên của người thật bằng Test Switcher.

## 4. Seed và reset

```powershell
npm run test:seed
npm run test:seed:verify
npm run test:reset -- --confirm-project=lgmlkagcytfjazulgfbz
```

Verify kiểm tra account/Auth/role, phạm vi kỹ sư, công nhân, báo cáo/ảnh/vướng mắc, cohort 50 và dữ liệu HR/công/lương/kho/XNK. File test mới được kiểm tra storage thực, checksum, magic bytes và visibility private. Đây là verify fixture, không thay thế đối soát nghiệp vụ E2E.

Ngày 08/10/2026 đã verify 10 tài khoản QA với Supabase Auth/role thật; 50 nhân viên cùng hợp đồng, lương, timesheet summaries, payroll lines và payslips; 1.992 attendance, 25 leave; hai dự án QA và scope kỹ sư; hai PNG và bốn PDF private với checksum hợp lệ. Seed chạy lặp lại thành công; stock audit/ledger giữ lịch sử append-only, không coi lần chạy seed là reset sạch.

`test:reset` chỉ khôi phục tài khoản QA/phân công/tiến độ quản lý bởi seed. Giữ ledger, audit, chứng từ, report/vướng mắc đã có và lịch sử E2E; không hoàn tác mọi thao tác UI. Seed coverage giữ chứng từ kho/dòng chứng từ đã có để tránh sửa dữ liệu ghi sổ.

Reset sạch chỉ có Docker riêng:

```powershell
$env:TEST_ENV_FILE='.env.development.local'
npm run test:config:check
if ($LASTEXITCODE -ne 0) { throw 'Cấu hình Docker chưa hợp lệ' }
node --input-type=module -e "import { loadTestConfiguration } from './scripts/testing/config.mjs'; const { target } = await loadTestConfiguration(); if (target.projectId !== 'local') throw new Error('Reset cần cấu hình Supabase Docker local');"
if ($LASTEXITCODE -ne 0) { throw 'File đang trỏ database khác Docker local' }
npm run test:local:reset -- --confirm-local=CT_NoiBo_Test
if ($LASTEXITCODE -ne 0) { throw 'Docker reset chưa thành công' }
npm run test:environment:init -- --confirm-project=local
if ($LASTEXITCODE -ne 0) { throw 'Marker Docker chưa khởi tạo thành công' }
npm run test:seed
if ($LASTEXITCODE -ne 0) { throw 'Docker seed chưa thành công' }
npm run test:seed:verify
```

Ledger/audit có trigger bất biến. Runner khóa account/Auth mình tạo sau test và giữ evidence trên DB test. Không hạ trigger để dọn dữ liệu. `seed:*:reset` cũ bị chặn trước DB.

Trở về Supabase cloud trong terminal bằng `$env:TEST_ENV_FILE='.env.e2e.local'`; chạy `test:config:check` rồi build/start app theo mục 2.1.

## 5. Quality gate và Playwright

```powershell
npm run validate:migrations
npm run lint
npm run typecheck
npm run test
npm run test:e2e -- --list
```

Chạy server test tối ưu và E2E trong hai terminal:

```powershell
npm run e2e:build
npm run e2e:start
```

```powershell
npm run test:e2e:business
```

Với staging đã deploy, dùng `TEST_ENV_FILE=.env.staging.local` và E2E URL đúng HTTPS; chỉ chạy business runner, không build/start local với URL remote. Trở về local bằng `Remove-Item Env:TEST_ENV_FILE`.

Runner dùng `playwright-core`, Edge trên Windows. Máy khác đặt `UI_QA_BROWSER` thành executable Chromium đã cài. [Catalog](E2E_CASES.md) có 241 ca đăng ký; đăng ký không phải pass. `npm run test:e2e:readiness` chạy riêng ba regression cho font/redirect/loading/prefetch bằng fixtures cục bộ. Reports JSON/Markdown, screenshot, manifest, storageState ở `test-results/e2e/<runId>/`. Cookie trong storageState là secret; không commit hoặc upload public.

Nghiệp vụ được gọi qua API thật/session thật; một số luồng thêm thao tác form trình duyệt. Không phải mọi CRUD đều được click UI. Payroll fixture dùng kỳ riêng và roster một người để đối soát số tiền; chưa chứng minh payroll toàn công ty.

Kiểm tra production local riêng:

```powershell
node scripts/testing/review-app.mjs build
node scripts/testing/review-app.mjs start
```

Terminal khác:

```powershell
$env:SMOKE_BASE_URL='http://localhost:3400'
npm run smoke
npm run smoke:production
npm run test:client-secrets
```

Scan secrets so khớp giá trị env local với client build, không in giá trị. Không thay thế scan hosting thực tế.

## 6. Xử lý lỗi

| Lỗi | Xử lý |
|---|---|
| Cấu hình test thiếu biến/URL trống | Điền các biến được liệt kê trong đúng file báo lỗi; chạy lại `test:config:init` và `test:config:check` |
| Thiếu `E2E_SUPABASE_URL` | Điền `NEXT_PUBLIC_SUPABASE_URL` của project test rồi chạy lại init; đồng bộ alias đã có nếu đổi project |
| Test tools disabled/API 404 | Kiểm tra APP_ENV/RELEASE_ENVIRONMENT/flag, build lại đúng target |
| URL/project mismatch | Đồng bộ ba URL; không tái dùng `.env.local` |
| Thiếu marker | Kiểm tra bootstrap/manifest của project test rồi init đúng project ID |
| Account/Auth collision | Kiểm tra target/ownership; không xóa account va chạm |
| Thiếu danh mục/period | Chưa seed SQL/cohort trước fixture QA |
| Staging 401 | HTTP Basic staging và cổng tester là hai bước riêng |
| Quick Login 401/403 | Mở gate; kiểm tra marker và account verify |
| Docker chưa chạy | Cài/mở Docker Desktop, kiểm tra docker info |
| Browser không tìm thấy | Điền UI_QA_BROWSER với executable thật |
| E2E FAIL/BLOCKED | Đọc error/screenshot/manifest, giữ audit để đối chiếu |

Khi thiếu cấu hình, các lệnh test dừng trước truy cập DB, trả exit code 1 và chỉ báo tên file/tên biến cần điền; không in giá trị secrets. `test:config:init` không cấp credentials Supabase: lấy chúng từ project test của bạn.

Test account bị chặn trong production là hành vi chủ đích. Dữ liệu test đã có ở database dùng chung trước thay đổi này không được tự động xóa/chuyển.
