# Manifest triển khai riêng cho doanh nghiệp

CRM team setup có thể xuất manifest v1 từ hồ sơ đã lưu. Các trường tùy chọn `customer.address/phone/email/taxCode/representativeName` và `branding` dùng trong activation patches; branding dùng schema runtime chung. File xuất từ CRM đặt asset/logo và tiêu đề phụ rỗng rõ ràng để bỏ nhận diện mẫu cũ khi áp cấu hình vào database mới. Không chứa credentials. [Luồng CRM triển khai](operator-crm-guide.md).

## Phạm vi đã có

Manifest v1 xác định một bản cài và một Supabase project hiện hữu. Validator và kế hoạch chạy hoàn toàn local, không đọc `.env`, không gọi Supabase, không ghi database, không tạo admin và không áp dụng migration. Chúng kiểm tra hợp đồng cấu hình và tạo fingerprint để operator đối chiếu trước khi triển khai.

Nguồn module/gói ngành dùng chung là `src/config/erpRegistry.json`. Ứng dụng đọc qua `erpModules.ts`; công cụ Node đọc cùng JSON. Nhãn, quyền và nội dung các preset hiện hành được giữ nguyên. Module dự kiến như sản xuất may, mua hàng, bán hàng và kế toán tổng hợp không được khai báo như capability đang có.

Đây là nền tảng P2, chưa phải installer hoàn chỉnh. Wizard có bản nháp trình duyệt và command activation nguyên tử đã có; xem [hướng dẫn activation](customer-activation-guide.md). Còn kiểm tra quyền sở hữu project từ server, checkpoint server, migration rehearsal toàn bộ stack, phát hành và nghiệm thu hai bản cài thật.

## Tạo cấu hình khách hàng

Sao chép `supabase/deployments/customer.example.json` sang file khác trong workspace. Project/org trong file mẫu là giá trị minh họa; thay bằng project thật đã tạo riêng cho doanh nghiệp trước khi sử dụng công cụ kết nối.

| Trường | Hợp đồng |
| --- | --- |
| `schemaVersion` | `1`; phiên bản khác bị từ chối |
| `deploymentId` | Mã bản cài chữ thường, số và dấu gạch ngang |
| `projectRef`, `apiUrl`, `dashboardUrl` | Cùng một Supabase project; URL phải khớp chính xác |
| `provisioningMode` | `existing-project`; chưa tự tạo project |
| `organizationId`, `region` | Metadata operator khai báo; validator local không xác minh quyền sở hữu hoặc region thật |
| `migrationsDirectory` | Chỉ `supabase/migrations` của release này |
| `includeDevelopmentSeed` | Bắt buộc `false` |
| `customer` | Tên công ty, tên viết tắt và tên hệ thống |
| `industryPreset` | `general`, `garment`, `construction`, `trading`, `services` |
| `enabledModules` | Danh sách capability đã có trong registry; không trùng, không tự gán quyền RBAC |
| `localization` | Hiện hỗ trợ `vi-VN`, `Asia/Ho_Chi_Minh` |
| `application` | Origin HTTPS; localhost HTTP chỉ được dùng trong development |
| `admin` | Username, tên hiển thị và mã nhân viên ban đầu; không có mật khẩu |
| `protectedExistingProjectRefs` | Các project cần bảo vệ thêm; không thể gỡ hai project cũ đã được bảo vệ trong code |

`enabledModules` là lựa chọn cụ thể của khách hàng. `industryPreset` ghi nhận gói ngành, không tự ghi đè lựa chọn đó. Kế hoạch tạo đủ cờ boolean, bao gồm `false` cho module không chọn. Không có module Dashboard.

Không đưa API key, access token hoặc mật khẩu vào manifest. Schema strict từ chối trường lạ ở mọi cấp; thông báo lỗi chỉ ghi tên trường, không ghi giá trị đầu vào. Tên/metadata doanh nghiệp vẫn là dữ liệu cần quản lý theo quy định nội bộ khi commit repository.

## Validate và xem kế hoạch local

```powershell
npm run deployment:validate
npm run deployment:plan
node scripts/database/plan.mjs --validate-only --manifest=supabase/deployments/customer.example.json
node scripts/database/plan.mjs --manifest=supabase/deployments/customer.example.json --environment-file=.env.customer.local
```

Hai lệnh npm mặc định dùng manifest DTech. Các lệnh có manifest mẫu chỉ kiểm tra dữ liệu mẫu. Kế hoạch đầy đủ ghi số lượng/tên migration cuối, SHA-256 của tập migration, SHA-256 cấu hình đã chuẩn hóa, preview settings và các bước operator còn phải thực hiện. Kết quả `valid: true` không xác nhận database đã cài đặt, có quyền truy cập, backup hoặc sẵn sàng thương mại.

`--environment-file` trong lệnh plan chỉ là tên file dự kiến, không mở file và không kiểm tra secrets. Tên này được dùng để tránh trùng tùy chọn `node --env-file`, vì Node có thể xử lý tùy chọn native trước khi script chạy.

Kế hoạch đầy đủ cho manifest khách hàng riêng bắt buộc truyền tên file môi trường riêng, giống các công cụ kết nối. Chế độ `--validate-only` cho phép bỏ qua tên file vì chỉ kiểm tra hợp đồng manifest.

## Công cụ kết nối hiện hữu

Các công cụ dưới đây đã nhận `--manifest`. Khi chọn manifest khác mặc định DTech, bắt buộc chọn file môi trường riêng; bootstrap còn bắt buộc file tài khoản riêng. Không được dùng lại `.env.local` hoặc `.env.admin.local` của DTech cho manifest khách hàng khác.

| Script | Tùy chọn | Tác động khi operator chạy |
| --- | --- | --- |
| `scripts/database/configure.mjs` | `--manifest`, `--environment-file`, `--check` | `--check` đọc inventory từ cloud; không có `--check` thì đọc API keys và ghi file môi trường local |
| `scripts/database/bootstrap-admin.mjs` | `--manifest`, `--environment-file`, `--credentials-file`, `--credentials-stdin` | Có ghi Auth, app account, role và hồ sơ nhân viên; cần cấp mật khẩu qua secret/env/stdin |
| `scripts/database/verify.mjs` | `--manifest`, `--environment-file` | Đọc database/storage/Auth và kiểm tra truy cập anonymous, đối chiếu settings với manifest |

Những script kết nối này không được thực thi trong đợt phát triển nền tảng. Phải thực hiện review target, backup/rehearsal, customer settings và phê duyệt vận hành theo runbook trước khi chạy với dữ liệu thật. Chúng không tự chạy SQL cleanup hoặc seed development.

Khi `--environment-file` được chọn cho bootstrap/verify, URL và Supabase keys chỉ lấy từ file đó, không mượn key còn thiếu của instance đang chạy. File secret phải có tên `.env*.local` tại gốc workspace, nằm trong quy tắc Git ignore hiện hành; symlink bị từ chối. Mật khẩu không đi qua argv hoặc manifest, không có mật khẩu mặc định. Cấu hình mặc định DTech vẫn hỗ trợ quy trình đã nạp env vào process trước khi chạy script.

Writer file môi trường/tài khoản kiểm tra từng giá trị bằng phép serialize → `parseEnv` và chỉ ghi khi đọc lại nguyên vẹn. Dấu nháy, dấu gạch chéo ngược và chuỗi `\\n` được giữ đúng, không dùng JSON escaping để ghi dotenv. Giá trị có ký tự điều khiển/xuống dòng, hoặc kết hợp cả ba dấu nháy với `#`/khoảng trắng đầu cuối mà parser không biểu diễn nguyên vẹn, bị từ chối trước khi ghi file hoặc chạy bootstrap Auth. Thông báo lỗi không ghi giá trị; operator cần chọn mật khẩu khác có thể biểu diễn trong dotenv. Không tự đổi hoặc rút gọn mật khẩu.

Đầu vào `--credentials-stdin` chỉ nhận JSON có một trường `password` dạng chuỗi hợp lệ. JSON sai hoặc giá trị sai kiểu trả lỗi cố định; không chuyển tiếp chẩn đoán `JSON.parse`, nội dung đầu vào hoặc mật khẩu vào message/stack.

`verify` đối chiếu tên hệ thống/công ty, tên viết tắt và toàn bộ capability với manifest. Sau khi người quản trị đổi lựa chọn trong ứng dụng, cần cập nhật manifest đã review để phép đối chiếu phản ánh cấu hình được phê duyệt.

## Tương thích và phần còn lại

Manifest DTech đã chuyển sang v1 mà không đổi target, tài khoản, tên công ty hoặc lựa chọn module. Adapter versionless chỉ dành cho đúng project/name DTech ban đầu; khách hàng mới phải dùng v1 để không nhận nhầm branding hoặc mã admin DTech.

`settingsPreview` vẫn là dữ liệu review, không được ghi qua plan/configure. Dùng wizard hoặc [activation CLI](customer-activation-guide.md) để công bố bốn nhóm cùng transaction sau khi review. Bootstrap tài khoản vẫn tạo/cập nhật nhiều thành phần theo bước riêng, chưa rollback nguyên tử toàn bộ. Rehearsal toàn bộ bộ cài, isolation hai instance và UAT vẫn là hạng mục tiếp theo.

Migrations lịch sử có dữ liệu cấu hình/nhận diện của khách hàng cũ. Không sửa hàng loạt seed lịch sử để ghi đè doanh nghiệp đang chạy. Bản cài mới phải áp dụng đầy đủ customer settings đã review trước khi mở cho người dùng; chỉ chạy migrations/bootstrap chưa tạo ra một bản cài trung lập đã sẵn sàng bàn giao.

Kiểm thử nằm ở `scripts/database/deployment-manifest.test.mjs`, `deployment-environment.test.mjs`, `environment-format.test.mjs` và `src/config/erpModules.test.ts`. Chúng bao gồm target bảo vệ không thể bỏ qua, URL không khớp, seed development, secrets đặt sai, module/locale chưa hỗ trợ, file secret riêng, không mượn keys giữa instance, roundtrip mật khẩu tổng hợp và tính hợp lệ của preview theo schema runtime.
