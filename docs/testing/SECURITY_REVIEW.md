# Security review DEV/STAGING — 08/10/2026

Review auth/session, proxy, testing API, provision/bootstrap, seed/reset, browser build và E2E, cập nhật ngày 09/10/2026. Supabase test độc lập `CT_NoiBo_Test` (`lgmlkagcytfjazulgfbz`) đã được tạo ngày 08/10/2026 trong tổ chức `jdfobdsnqqpyqfgbveke`, gói Free, Singapore (`ap-southeast-1`), `ACTIVE_HEALTHY`. Credentials test đã cấu hình; 39 migration, SQL seed, bootstrap chạy lại và seed/account/storage verify đã thành công. Business E2E `20261009ec2c4f` hoàn tất **243 PASS, 0 FAIL, 0 BLOCKED**, bao gồm SETUP/SEAL và chuyển vai trò qua native selector; bằng chứng và giới hạn ở [RESULTS](RESULTS_2026-10-08.md). Review này không phải penetration test hosting/database; staging HTTPS chưa deploy.

| Điều kiện | Bảo vệ | Bằng chứng / giới hạn |
|---|---|---|
| Production không dùng Quick Login | Environment guard trước body/DB/Auth | Unit + production API/browser smoke |
| Không giả mạo role | Username allowlist, body strict, RBAC từ DB | Unit role/password bị từ chối; authored E2E permissions |
| Auth hiện hữu | Supabase password + app_sessions thật | Đã verify liên kết Supabase Auth/role thật của 10 QA accounts; login/session live theo báo cáo E2E |
| Tester được phép | Basic Auth staging + HMAC grant + DB marker | Unit token/staging/marker; chưa deploy staging |
| Không thay session thật | Cũ/mới đều managed account | Unit chặn account thật; auth mới lỗi giữ session cũ |
| Tách DB/secrets | Exact URL/project, hash fingerprints không trùng | Project mới có ref khác production; `.env.e2e.local` chỉ nhận publishable/secret keys của project test |
| Session isolation | Cookie suffix, reload, revoke QA cũ | Unit cookie; trạng thái switch/refresh live theo báo cáo E2E |
| Không overwrite người thật | Stable ID/metadata/target/employee note/Auth checks | `test:seed` chạy lặp lại exit code 0 trên DB test; owned fixtures được verify |
| Reset không xóa production | Guard trước DB, marker, project confirmation | Unit production/reset denial; Docker chưa có |
| Test account không dùng production | Reject metadata khi sign-in và resolve session | Unit policy; cohort cũ không bị tự xóa |
| Không lộ secrets | Server env; account list chỉ label/username/status | Unit response + client scan; chưa scan hosting |
| Không gửi tích hợp thật | deliverWebhook chặn dev/test/staging trước fetch | Policy unit + review outbound path |
| Private files owned | Metadata/checksum/collision guards | Hai PNG và bốn PDF đã download verify storage thật, checksum/magic bytes và visibility private |
| Provision đúng phạm vi Free | Tổ chức/tên/vùng cố định, quota Free, xác nhận create, ref khác production | Review script + project thực tế Free; không chọn compute/add-on trả phí hoặc nâng gói |
| Bootstrap đúng target | Env riêng, manifest owner, xác nhận ref, guard và SHA256 migration | 39 migration + SQL seed đã áp dụng; chạy lại SKIP, checksum migration và audit tồn kho PASS |
| Management credential private | Token CLI chỉ đọc trong memory; redaction lỗi token/key/database password | Không in token/key/password; manifest và env nằm trong đường dẫn Git bỏ qua |

## Quyết định

- Không tắt trigger ledger/audit. E2E khóa account/Auth của lượt chạy và giữ chứng từ trên DB test.
- Không reset sạch remote; allow-remote không thay thế environment/marker.
- Staging dùng Supabase hostname chuẩn, không query/hash/path/port tùy ý.
- Bốn profile QA dùng permission catalog hiện hữu; cần review nghiệp vụ, không là role chuẩn production.
- Grant tester tối đa tám giờ; cấp passwords/gate qua secret manager.
- Storage object chưa có owned metadata bị từ chối overwrite.
- Dùng lại project đã provision bằng `status/configure`; lệnh `create --confirm-create=CT_NoiBo_Test` chỉ ghi lại thao tác tạo lần đầu được duyệt. Không coi provisioning là quyền tạo project/tổ chức khác hoặc tài nguyên trả phí.
- Bootstrap chỉ nạp SQL seed một lần, kiểm tra checksum các migration đã áp dụng và giữ chứng từ; stock ledger/audit vẫn append-only.

## Còn phải xác nhận

1. Bộ 241 ca E2E đã PASS cùng SETUP/SEAL trên app `localhost:3300` và Supabase test thật. Auth/session/switch/deny/scope được kiểm tra theo catalog; chưa chứng minh mọi policy RLS hoặc mọi tổ hợp quyền, concurrency và thao tác UI. Seed/account/private file verify sau lượt cuối tiếp tục PASS.
2. Thiếu hosting/domain: chưa xác minh HTTPS, Basic Auth/protection và biến môi trường trên deployment.
3. Init marker kiểm tra accounts; không chứng minh mọi business row là test. Chỉ dùng project mới/đã audit.
4. Bootstrap đã xác nhận tồn kho mẫu khớp ledger bằng `audit_inventory_balance(null)`. Snapshot legacy công/lương vẫn là fixture để kiểm tra màn hình; đối soát nghiệp vụ và payroll toàn công ty cần kết quả riêng.
5. Test source vẫn nằm trong server build nhưng production guard disabled. Scan local không chứng minh release trên hosting.
6. Report/storageState/manifest cần lưu private. Manifest `test-results/provisioning/CT_NoiBo_Test.private.json` chứa database password; không in, commit hoặc upload public. Account test cũ trên môi trường mặc định production có thể không đăng nhập được sau cập nhật; chuyển test sang target riêng.

Trước khi mở staging: chạy account verify, seed verify, full E2E và kiểm tra gate bằng browser chưa đăng nhập. Xác nhận không có provider/scheduler production trỏ tới staging. Không đánh dấu các bước này pass bằng unit mock.
