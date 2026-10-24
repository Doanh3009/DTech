# DTech Commercial ERP — Execution Report

## Quy trình sáu ngành và đồng bộ setup — 23/10/2026

Đợt này bổ sung nhập thành phẩm, xuất vật tư công trình, tính sản lượng công đoạn cuối, chốt khuôn/đơn giá giờ, kiểm soát định mức và đảo chứng từ; màn vận hành theo module có đối chiếu thực tế và truy xuất lô nhiều cấp. Web setup có catalog sáu ngành, tạo hồ sơ theo gói và command đồng bộ cấu hình với tenant. Chi tiết và giới hạn ở [quy trình sáu ngành](../erp/industry-workflows.md).

Landing giữ bố cục và giao diện nổi 3D, thay thanh kéo bằng ba bộ số liệu minh họa cố định; mỗi ngành có mẫu màn hình, luồng chứng từ và danh sách module riêng, mở lớn được. Chọn đăng ký từ ngành nào thì biểu mẫu nhận ngành đó. Các bước triển khai có đầu ra cụ thể.

Migration mới `202610230012`–`202610230014` chỉ được biên dịch trên PostgreSQL tạm, chưa áp dụng cloud. Registry và DDL khớp 25 loại danh mục/chứng từ. Không chạy test suite trong lượt này; các số kiểm tra ở mục giao hàng bên dưới là bằng chứng lịch sử, không đại diện nghiệm thu nghiệp vụ mới. Hình xem trước local dùng dữ liệu minh họa/intercept, không tạo tài khoản hoặc dữ liệu khách hàng cloud.

Lint, typecheck và webpack build cuối qua. Đã xem ảnh local ở 1440/768/390px, không tràn ngang trang; phần so sánh có 0 thanh kéo và đăng ký từ ngành điện tử giữ đúng lựa chọn. Các fixture test hiện có được điều chỉnh theo chữ, props và số loại chứng từ mới, không chạy suite hoặc thêm test case. [Bằng chứng biên dịch và phạm vi](evidence/industry-workflows-build.json).

## Giao hàng theo đơn bán — 23/10/2026

Bổ sung giao hàng từng phần tại chi tiết đơn bán của ERP khách (`/erp/[slug]/sales_orders`). Có bảng đặt/đã giao/còn giao và command xuất nhiều hàng/kho/lô trong một transaction. Retry giữ UUID/body; chỉ đóng khi receipt khớp. Trigger sổ kho chặn hàng ngoài đơn, giao vượt, trả vượt và ngày sai cho cả thao tác thủ công; phiên bản đơn tăng theo phát sinh. Đảo giao hàng của đơn hoàn thành mở lại đơn, giữ công nợ theo giá trị đơn.

Migration `202610230010_business_sales_fulfillment.sql` là forward migration, phụ thuộc nền tảng business cùng project; `202610230011` khóa và kiểm tra lại phiên để chặn lệnh chờ sau đăng xuất và tránh deadlock khi hai phiên đổi mật khẩu. Chưa áp dụng cloud trong đợt này. Quyền và phạm vi lấy từ session business, không từ tenant/account người dùng gửi. [Hợp đồng và cách dùng](../erp/sales-fulfillment.md). Bằng chứng native ở `evidence/business-platform-integration.json`: **46 checks passed**, cluster đã dừng, không truy cập cloud; unit/API/component có thêm 10 checks cho input, viewer, retry và receipt. Đây là slice bán hàng–kho, chưa đại diện nghiệm thu ERP thương mại hoặc kế toán tổng hợp.

Landing giữ bố cục đầu tiên với chữ bên trái và khối ERP bên phải; signature là màn hình giao diện nổi 3D bằng CSS/SVG, tabs thật, biểu đồ mẫu và thẻ phê duyệt. Có nút dừng chuyển động/reduced motion, sáu tình huống ngành và biểu đồ so sánh đầu vào có công thức/bảng số liệu. Các hình mascot/công trường/kho và khối trừu tượng không được dùng trong bản cuối.

Quality gate cuối: **1.936 unit/API/component checks passed**, 37 skipped; 220 test files passed và một skipped. Full lint/typecheck/webpack build qua. Native PostgreSQL có **46 checks passed**, fingerprint khớp source. Browser landing 1440/768/390/320px qua, không lỗi runtime hoặc tràn ngang; kiểm tra pointer/keyboard cho màn 3D, dừng chuyển động, reduced motion, sáu ngành và mô phỏng số liệu. [Tổng hợp bằng chứng](evidence/qa-sales-dimensional-landing.json) ghi rõ phạm vi local, retry của lượt unit timeout ban đầu và việc chưa rollout cloud.

## CRM riêng cho team setup — 23/10/2026

### Phạm vi được xác nhận

CRM thuộc đội DTech cung cấp dịch vụ và custom triển khai cho khách; không phải module Sales/CRM của ERP doanh nghiệp. Portal riêng `/control-center/login` → `/control-center/customers`; inbox đăng ký tại `/control-center/trials`. ERP khách giữ deployment/Supabase riêng và cấu hình nội bộ `/system-admin/setup`.

### Đã triển khai

- Form đăng ký bổ sung loại hình, mã số thuế/website tùy chọn, chức vụ, địa chỉ/tỉnh, số chi nhánh, công cụ và thời điểm triển khai. Giữ consent, UUID/HMAC/retry, giới hạn body/quota và không lưu PII trong browser storage. Trang xác nhận hướng khách nhận login URL riêng trong thông tin bàn giao.
- Hồ sơ khách hàng có khảo sát, người phụ trách/lịch liên hệ, chọn preset/module thực có, thương hiệu tên hệ thống, yêu cầu custom, môi trường/admin metadata, khoảng dùng thử, checklist và giai đoạn. Activity ghi chú/cuộc gọi/email/cuộc hẹn cùng lịch sử.
- Chuyển lead phù hợp thành khách hàng nguyên tử, giữ nguồn/consent và chống tạo trùng khi retry hoặc hai người thao tác. Hồ sơ và activity có CAS/actor/quyền/audit/rollback trong PostgreSQL; target cũ/DTech được bảo vệ. Đổi cấu hình làm hết hiệu lực xác nhận trước.
- Danh sách khách hàng và yêu cầu phân trang server 25 hàng. API/page có quyền operator riêng; role `deployment_team` không có quyền admin ERP. Chưa tạo hoặc gán user setup mới.
- Manifest xuất từ hồ sơ dùng validator/plan/configure/bootstrap/activation CLI hiện có; đầy đủ organization patches, branding trung tính để bỏ asset/tên phụ mẫu cũ, không có credentials. Không tự áp hồ sơ khách vào settings DTech.
- `DTECH_CONTROL_CENTER_ENABLED` chỉ bật trên DTech; bản khách tắt và không có CRM/intake/landing DTech. CLI tách cờ môi trường giữa instance và từ chối bật CRM cho customer target.

### Bằng chứng

- **1.899 unit/API/component checks passed**, 37 skipped, 215 test files (214 passed, 1 skipped). Full lint/typecheck và webpack build qua.
- **27 native PostgreSQL checks passed**, cluster tạm đã tắt. Có CAS race, conversion race, idempotency, audit rollback, ACL/RLS, target protection và setup gates. Auth trong native vẫn là stub; không dùng cloud credentials.
- Browser CRM: 24 viewport captures, 1440/768/390px, đầy đủ bốn phần hồ sơ, manual intake gói dịch vụ/custom module, chuyển lead, tải manifest, conflict/reload, activity và form public. Ghi khách/nghiệp vụ đều intercept trước network; chỉ đăng nhập/đăng xuất DTech thật.
- Regression marketing: 17 page visits, cả 9 module, ba kích thước; không còn spinner/nút load trên card hoặc dãy module trong nghiệp vụ. Tổng hợp CRM + marketing có **18 route tĩnh và 1 template động** được kiểm tra, không đại diện toàn bộ 208 trang.
- Cờ operator tắt: **9 HTTP checks**, root sang login; CRM page/API và intake 404; login không có link đăng ký DTech. Đây là kiểm tra cờ local, chưa phải rehearsal hai database khách.
- PostgREST: hai quan hệ lead→customer và activity→actor được kiểm tra SELECT limit 0, không đọc nội dung khách hàng. Client build: **633 artifacts, 0 secret matches**.
- Source inventory: **208 pages, 296 API files, 61 migrations, 184 declared tables, 146 declared RPC names, 203 source test files**; 666 dependency entries.

### Development database

Migration `202610220005_operator_customer_crm.sql` đã áp vào đúng `tcjjhxqtreemccdbvyza` sau native hashes, manifest/link/environment guard và dry-run đúng một migration. Tổng migration 60→61; permission 234→236; role 5→6. CRM/customer/activity/lead đều 0 bản ghi thật sau rollout; account/Auth user/employee vẫn 1, history/projects/items/warehouses vẫn 0 và settings versions không đổi. Không tạo khách giả, cloud project khách, Auth user, email, bản phát hành hoặc production migration.

Xem [hướng dẫn vận hành CRM](operator-crm-guide.md), `evidence/operator-crm-integration.json`, `operator-crm-rollout.json`, `operator-crm-feature-off.json`, `qa-operator-crm.json`. Checklist là operator xác nhận sau triển khai thực tế; trial dates chưa tự khóa tài khoản. Pilot team setup, cấp cloud/Auth thật, bàn giao khách và các gate UAT/restore/two-instance vẫn cần thực hiện với khách được chọn. Module Sales/GL/Procurement/Manufacturing của ERP chưa được coi hoàn thành bởi slice CRM triển khai này.

## Landing sản phẩm, tiếp nhận dùng thử và điều hướng ERP — 22/10/2026

### Yêu cầu và hành trình đã chọn

- Xử lý cảm giác khựng khi chọn module, spinner/nút phụ trên từng thẻ, nhận diện module lặp trong sidebar và bề mặt nghiệp vụ thiếu nhất quán.
- Người dùng chọn tiếp nhận yêu cầu rồi DTech cấp môi trường/tài khoản riêng. Hành trình: landing → form dùng thử → xác nhận tiếp nhận → trao đổi/cấp môi trường → đăng nhập → gateway → module. Nút đăng nhập riêng cho người đã có tài khoản; không tự đăng ký Auth hoặc tự cấp database.
- Người dùng cung cấp bối cảnh doanh nghiệp xây dựng cần chuyển đổi số, chưa cung cấp tên/logo/kết quả khách hàng được duyệt công khai. Landing dùng tình huống xây dựng có nhãn minh họa và ghi rõ chưa phải case study đã nghiệm thu.

### Thay đổi thực tế

- Root `/` trở thành trang giới thiệu công khai; thêm `/dang-ky-dung-thu` và `/quyen-rieng-tu`. Landing có bản xem thử UI tương tác bằng bàn phím/con trỏ, phạm vi giải pháp hiện có, tình huống xây dựng, bước triển khai, FAQ và CTA thống nhất. Không dùng số liệu, testimonial, tên hoặc asset khách hàng giả.
- Marketing dùng product copy tập trung ở `src/config/marketing.ts` và page override trong Design DNA; giữ Inter/Lucide đã có, không thêm dependency hay ảnh/asset bên thứ ba. Mẫu Digiwin được xem để tham khảo trình tự nội dung; không sao chép giao diện, số liệu hoặc case study.
- Thẻ module chỉ còn icon/nhãn và toàn thẻ là link. Bỏ spinner, nút mũi tên tròn và watermark; giữ hình học ổn định. Full prefetch chỉ bật khi hover/focus/touch theo hướng dẫn Next 16.3.8 đang cài, không đồng loạt tải đầy đủ mọi nghiệp vụ ngay khi mở gateway.
- Bỏ React ViewTransition và JS fade/translate toàn vùng nội dung, giữ DOM/main boundary ổn định. Page loading thành thanh mảnh chung có độ trễ 200ms; feedback cho action vẫn được giữ. Không thay đổi server permission/module gates.
- Sidebar chỉ còn nghiệp vụ trong module; bỏ thẻ nhận diện lớn và hàng gateway lặp, giữ một icon về gateway cạnh thương hiệu. Breadcrumb giữ ngữ cảnh. Khung ERP dùng nền trung tính/bề mặt trắng, token chung và primary color theo cấu hình. Login có lối về giới thiệu/dùng thử; return link nằm trong card để không bị che ở tablet/điện thoại.
- Form thu company/contact/email/phone/industry/size/needs và consent. Strict schema, body tối đa 10KB, honeypot, deadline và HMAC domain riêng; không lưu raw IP hoặc lead PII vào log/browser storage. Timeout giữ request UUID/body trong bộ nhớ để thử lại nguyên yêu cầu, chỉ xác nhận sau receipt đúng.
- Thêm bảng riêng `product_trial_requests` và hai service-only RPC. Intake idempotent, quota network/contact/global được kiểm tra trong transaction; replay trước quota. Review có active-actor/permission check, lifecycle lock, CAS, state transitions và audit nguyên tử; audit structured data chỉ có trạng thái/version.
- GET/PATCH yêu cầu và `/system-admin/trial-requests` có quyền riêng `trial_request.view/manage` cùng `system_admin.access`; chỉ admin được grant mặc định. UI xem, tìm/lọc trên 100 yêu cầu mới nhất, xử lý conflict/ambiguous outcome bằng tải lại; không gọi Auth hoặc gửi email tự động.

### QA và development rollout

- **1.849 tests passed, 37 skipped**, 206 test files pass và một skipped, 207 tổng. Full lint/typecheck và review webpack build pass. Static-generation settings fallback trong sandbox được ghi riêng ở raw build log; runtime kiểm tra bằng kết nối development thật.
- **32 native PostgreSQL checks pass** trên 17.10, cluster tạm đã dừng, dùng hai migration foundation thật và migration intake. Có validation/consent, immutable replay, quotas, ACL/RLS, review permissions/CAS, audit rollback và hai connection cho submit/review races; không truy cập cloud hoặc chạy Auth.
- Browser marketing bao phủ bốn trang công khai, confirmation, gateway, cả chín module khả dụng và queue quản trị ở **1440/768/390px**. Các lượt mở module đo trong điều kiện local, sau hover prefetch 500ms và với reduced motion tắt; đây là sample latency, không phải SLA hoặc benchmark trước/sau. Các số đo cuối nằm trong QA evidence.
- Bản build cuối: **35 visits, 23 route/template duy nhất** (20 tĩnh, 3 động), gồm 17 visits marketing +5 foundation +2 employee +11 lifecycle. Cả chín điểm vào module đã duyệt; không runtime/API lỗi bất ngờ hay tràn ngang trong phạm vi này. Click→heading local sau prefetch: **47–152ms**. Đã xem trực quan landing, form, hub, queue và login điện thoại; hit-test xác nhận link về giới thiệu không bị che ở desktop/tablet/mobile.
- Synthetic intake 503 → retry cùng UUID/body → 202; synthetic review 409 → giữ reason/khóa sửa → tải lại version → receipt xác nhận. Mọi POST/PATCH lead thử được intercept; read-only queue/API và quyền anonymous được kiểm tra thật. Chỉ phiên audit đăng nhập/đăng xuất cập nhật authentication/session metadata của chính nó.
- Migration `202610220004_product_trial_requests.sql` đã áp dụng vào DTech development `tcjjhxqtreemccdbvyza` sau native/hash/target/preflight/dry-run đúng một migration. Cloud có **60 migrations**, table rỗng/RLS bật, service SELECT và execute đúng hai command, không direct write; anon/authenticated không đọc hoặc execute. Hai permission mới chỉ grant cho admin.
- Counts account/Auth user/employee/history/projects/items/warehouses và settings versions trước/sau giữ nguyên; không seed, tạo lead/Auth giả, đổi credentials, dựng instance khách mới hoặc phát hành production. [Bằng chứng rollout](evidence/marketing-rollout.json) ghi hash migration, dry-run/apply và ACL metadata.
- Source inventory: **202 pages, 291 API files, 60 migrations, 182 declared tables, 139 declared RPC names**, 666 dependency entries. Client scan và phạm vi regression cuối được ghi trong [QA đợt này](evidence/qa-marketing.json); raw logs/ảnh chỉ ở `.tmp/erp-marketing-*`.
- Client scan: **619 artifacts, 0 secret matches**. Các lỗi 409/503 trong browser được mô phỏng có chủ đích; sensitive explicit-null clearing vẫn được chứng minh bằng unit/native khi giá trị bank hiện có trống.

### Bàn giao / giới hạn

- [Hướng dẫn marketing và dùng thử](marketing-trial-guide.md), [Design DNA marketing](../../design-system/dtech-erp/pages/marketing.md). Actual customer case studies cần nội dung/asset/quyền công khai được xác nhận. Intake/review đã triển khai; cấp môi trường/tài khoản, retention/xóa dữ liệu và chống spam tại ingress là việc vận hành có người phụ trách.
- Scope này chưa triển khai sales CRM, tự động provisioning, email automation hoặc hoàn thành toàn bộ ERP thương mại. Các gate domain/GoTrue/UAT/isolation/restore/IP trong roadmap tiếp tục giữ trạng thái riêng.
- Giữ working tree/nhánh và thay đổi trước đó; chưa commit/push/PR hoặc production deployment. Các phần phía dưới là lịch sử từng đợt.

---

## Khôi phục tài khoản và hồ sơ nhạy cảm nguyên tử — 22/10/2026

### Phạm vi và thay đổi

- Tiếp tục cùng working tree/nhánh/baseline và giữ thay đổi các đợt trước. Hoàn thành slice account lifecycle recovery + sensitive/archive; ERP thương mại vẫn chưa hoàn chỉnh.
- Cấp tài khoản dùng durable operation với request UUID, reserved account/Auth UUID và payload bất biến. Sau lỗi hoặc timeout, service đọc lại đúng identity trước khi hoàn tất; không tự xóa Auth để bù khi chưa xác định kết quả DB. Retry cùng request không tạo thêm account/history/audit.
- Hủy provisioning ghi ý định cleanup trước khi thu hồi Auth. Xóa tài khoản thu hồi truy cập, phiên và vai trò, lưu tombstone cùng operation/history/audit trong một transaction trước khi gọi Auth; lỗi ngoài hệ thống để lại yêu cầu có thể tiếp tục.
- Quyền mới `account.delete` chỉ cấp sẵn cho admin. Cấp role ngoài employee cần thêm `account.assign_role`; quyền được kiểm tra lại khi prepare, đọc, tiếp tục hoặc hủy. API status/roles trả receipt tối thiểu, bỏ audit/read rời sau commit.
- Operations có RLS; service chỉ SELECT trực tiếp và execute public command đã kiểm tra actor; private helpers không được service execute. RPC provisioning cũ bị thu hồi service EXECUTE. Các command dùng cùng lifecycle advisory lock trước employee/account row locks và bảo vệ admin cuối cùng.
- Trigger chặn Auth identity được tạo trễ sau hủy, xóa Auth vẫn đang liên kết, thêm role vào tombstone và đăng ký phiên cho account đã vô hiệu. Chứng minh lock order dựa trên schema hiện tại không có FK từ `app_accounts.auth_user_id` sang Auth; thêm FK/writer khóa Auth cần review lại.
- Không lưu mật khẩu plaintext trong operation hoặc browser storage. Credential fingerprint dùng HMAC với pepper cấu hình; mật khẩu tự sinh chỉ trả cho người tạo trong cửa sổ 15 phút đầu, không reset mật khẩu Auth đã tồn tại. Đổi pepper giữa lúc pending cần xử lý theo [hướng dẫn recovery](account-lifecycle-recovery-guide.md).
- Sensitive patch và archive dùng một RPC với `employees.row_version` chung. Omission giữ nguyên, null xóa trường cho phép; history/audit sensitive chỉ ghi tên trường/version. Archive giữ trạng thái lao động nhưng thu hồi account/phiên liên kết cùng transaction; cả hai có rollback history/audit.
- UI giữ request/body khi cần thử lại, khóa sửa khi kết quả chưa rõ và xóa secret khỏi state khi hoàn tất/đóng. Recovery có trong quản trị người dùng và inline theo nhân sự ở tab Tài khoản; không đòi thêm `user.view` cho người đã được mở hồ sơ/tab và có quyền tương ứng. Nhóm nút dùng vùng actions chung của DataTable để không cắt nhãn trên điện thoại.

### QA và rollout development

- **1.798 tests passed, 37 skipped**; 199 test files pass và một skipped, 200 tổng. Full lint/typecheck và review webpack build pass. Static generation trong sandbox vẫn ghi `system_settings.read_failed`; runtime được kiểm tra với kết nối development thật. Raw logs ở `.tmp/erp-p3b-*`.
- **165/165 native PostgreSQL checks pass** trên 17.10, cluster tạm đã dừng. Có reservation/replay/cancel/delete, elevated-role revocation, tombstone, Auth/session races, final-admin races, shared employee CAS, null/date validation và injected rollback. Fixture Auth tối thiểu và role hạn chế không phải GoTrue đang chạy.
- Browser: 5 route nền tảng +2 template profile/edit +11 visits lifecycle, tổng **9 route/template duy nhất** (6 tĩnh, 3 động). Luồng lifecycle ở 1440/768/390px; các route nền tảng/profile-edit ở 1440/390px. Không runtime/API lỗi bất ngờ hoặc tràn ngang trong phạm vi này. Xem trực quan ảnh recovery/sensitive/archive và form nhân sự; kiểm tra nhãn thu hồi đầy đủ trên ba kích thước.
- Browser xác minh draft/dirty fields/CAS, giữ dữ liệu và khóa lưu khi 409/503; recovery thử lại cùng body, hủy không cần password, delete cleanup nhận completed receipt, temporary secret được xóa và không nằm trong local/session storage. Bốn sensitive/archive và 18 recovery mutations được intercept; không ghi hồ sơ hoặc tạo/xóa Auth thật để nghiệm thu.
- Validate **59 migrations**; scan **616 client artifacts, 0 secret matches**. Source inventory: 199 pages, 289 APIs, 181 declared tables, 137 declared RPC names; dependency inventory 666 entries. Các số này không chứng minh UAT hay workflow hoàn chỉnh.
- Sau preflight/native/hash/target guards và dry-run đúng hai migration, áp dụng `202610220002_account_lifecycle_recovery.sql` (SHA-256 `5447095750b61089607a41f82573d0ba62aef362e16070092d1a132cd103af12`) và `202610220003_atomic_employee_auxiliary.sql` (`3ddef740e78c94d6ecd9946c52a3b81ed89993b04a4328c382159299db7091b3`) vào project DTech development `tcjjhxqtreemccdbvyza`.
- Cloud sau rollout: 59 migrations/latest 202610220003, PostgreSQL 17.11; operation queue trống/RLS bật, 17 functions đúng ACL/SECURITY DEFINER/search_path và bốn triggers bật. Vẫn 1 active account/1 Auth user/1 employee/0 employee history events; projects/items/warehouses/settings versions không đổi. Chỉ thêm một permission và grant admin có chủ đích; không seed/bootstrap hay đổi credentials.
- Read-only Auth lookup UUID ngẫu nhiên trên project thật xác nhận `404 / user_not_found`, không tạo/xóa identity. Live Auth create/delete và full managed Auth schema vẫn chưa được nghiệm thu.
- Bằng chứng: [native database](evidence/atomic-lifecycle-integration.json), [development rollout](evidence/lifecycle-rollout.json), [QA/browser](evidence/qa-p3b-lifecycle.json); hướng dẫn [account recovery](account-lifecycle-recovery-guide.md) và [sensitive/archive](employee-auxiliary-command-guide.md). Công cụ capture từ chối report browser chưa hoàn tất và gộp mọi lần thăm/viewport theo route; raw logs/ảnh chỉ giữ local.

### Phần còn lại / bước tiếp

- Những gap account deletion/ambiguous provisioning và sensitive/archive ở báo cáo đợt trước đã được xử lý bằng các command trên. P3 rộng hơn còn identity-file/storage, employee creation/emergency contacts/contracts/rehire, retention và external/cron entitlement review.
- Cần isolated full Supabase rehearsal với Auth thật, nhiều persona, hai deployment tách biệt, UAT và restore drill. Direct SQL writers không tự tham gia advisory/CAS protocol; operation/tombstone/history chưa có purge/anonymization workflow.
- Purchasing PR → approval → PO → partial receiving/sổ kho là slice nghiệp vụ tiếp theo; Sales/GL/manufacturing chưa triển khai. Không đánh dấu commercial-complete từ số test/build.
- Chưa commit/push/PR hoặc phát hành ứng dụng production. Các báo cáo bên dưới là lịch sử từng đợt, không thay thế trạng thái cập nhật ở đây.

---

## Hồ sơ nhân sự và nghỉ việc nguyên tử — 22/10/2026

### Phạm vi và thay đổi

- Tiếp tục cùng working tree/nhánh/baseline; giữ các thay đổi trước đó. Đợt này hoàn thành command profile/offboarding và form tương ứng; chưa hoàn thành toàn bộ ERP thương mại.
- PATCH hồ sơ gọi đúng một RPC `patch_employee_profile_command`, bắt buộc phiên bản đang chỉnh. Không còn ghi employee, disable account và history bằng các request rời; audit cũng nằm trong giao dịch DB. API trả receipt `{employeeId,rowVersion}` và không đọc lại dataset sau commit.
- SQL kiểm tra active actor, quyền edit/offboard cho trường thay đổi, allowlist/type/null, ngày sau merge và chi tiết nghỉ việc. Một UPDATE tăng đúng một phiên bản, kể cả archive do nghỉ việc; account disable, revoke app sessions, history và audit rollback cùng nhau khi lỗi.
- Status/role/provisioning RPC dùng chung lifecycle advisory lock trước row locks. Chặn mất admin cuối cùng giữa các command này; chặn cấp/kích hoạt account cho nhân sự đã terminated/archived. Helper nội bộ bị chặn EXECUTE kể cả service role; public commands chỉ service role execute, search_path rỗng.
- Kiểm tra tham chiếu mới đang hoạt động và chuỗi quản lý không có vòng lặp, kể cả hai gán quản lý đối nghịch đồng thời. Giữ tham chiếu cũ ngừng hoạt động nếu không thay đổi; cho phép xóa quản lý bằng null.
- Form chỉ gửi trường đổi; null xóa trường tùy chọn, omission giữ nguyên. Có ngày sinh/giới tính/ngày vào làm/địa chỉ thường trú; giữ đúng lựa chọn cũ khi danh mục hoặc quản lý ngừng hoạt động. Quyền nghỉ việc được lọc; tái tuyển dụng không thực hiện bằng form sửa thông thường.
- Chặn double submit, timeout 30 giây; lỗi mạng/JSON/5xx hoặc 409 giữ dữ liệu nhập và khóa lưu cho đến khi tải lại. Đây là draft trong form hiện tại, không có lưu nháp nhân sự xuyên reload. Kết quả commit không xác định không tự retry/rebase; CAS cũ không tạo thêm lịch sử.
- Proposal cũ ngoài migrations được đánh dấu SUPERSEDED. [Hợp đồng và giới hạn command](employee-profile-command-guide.md).

### QA và rollout development

- **1.549 tests passed, 37 skipped**; 190 test files pass và một skipped, 191 tổng. Full lint, typecheck và review webpack build pass. Build có log settings read timeout trong sandbox khi prerender, không ngăn hoàn thành build; browser runtime dùng kết nối cấu hình thật đã qua.
- **88/88 native PostgreSQL checks pass** trên 17.10, cluster tạm đã dừng. Fixture dùng migrations nền tảng thật/các fragment có hash; có CAS/retry, ACL/actor, null/omission, date/ref/cycle, injected rollback tại employee/account/session/history/audit và concurrency của final-admin/provisioning/offboarding/manager.
- Browser trên bản review: 5 route nền tảng và 2 template động profile/edit, đều ở 1440/390px; không lỗi runtime/API hoặc tràn ngang trong phạm vi này. Sáu ảnh nhân sự đã xem trực quan. Empty submit không gửi command; 409/503 và draft recovery được mô phỏng bằng interception chặn mọi PATCH thật. Không offboard admin hoặc tạo dữ liệu nhân sự/chứng từ thử trên cloud.
- Validate **57 migrations**; scan **614 client artifacts, 0 secret matches**. Inventory mới: 199 pages, 287 APIs, 180 declared tables, 121 declared RPC names. Inventory không chứng minh workflow/UAT hoàn chỉnh.
- Sau preflight/dry-run xác nhận đúng một migration, áp dụng `202610220001_atomic_employee_profile.sql` vào project DTech development `tcjjhxqtreemccdbvyza`. SHA-256: `c608c3e5b95876709cf4cfa6e8f68cd62a7f2597fa32bd2064011c29bd9ab6c3`, trùng native evidence.
- Cloud sau rollout: 57 migrations, latest 202610220001; 5 functions đúng ACL/SECURITY DEFINER/search_path, 4 public commands có lifecycle lock, helper không service-executable. Vẫn 1 active account/1 employee/0 employee history events; counts projects/items/warehouses và settings versions không đổi. Không seed/bootstrap, đổi credentials hoặc deploy ứng dụng production.
- Bằng chứng: [native database](evidence/atomic-employee-integration.json), [development rollout](evidence/employee-rollout.json), [QA/browser](evidence/qa-p3-employee.json). Raw logs/ảnh có thể chứa dữ liệu hiển thị nên chỉ giữ ở `.tmp`.

### Phần còn lại / bước tiếp

- P3 vẫn PARTIAL: `deleteAccount` còn Auth/direct DB writes ngoài lifecycle lock; provisioning compensation khi kết quả commit không xác định chưa được xử lý an toàn; sensitive/archive commands còn history rời. Các account status/roles API cũ còn audit/read sau commit. Những đường này không được coi đã được bảo đảm bởi command mới.
- Session resolution kiểm tra trạng thái account/registry ở mỗi lượt; bộ native không chạy Supabase Auth/Storage/Realtime đầy đủ. Cần full-stack staging, cross-role/UAT, hai deployment và restore drill riêng. Direct SQL writers không tham gia advisory protocol; dùng READ COMMITTED như PostgREST mặc định.
- Purchasing/Sales/GL/manufacturing chưa triển khai. Bước kế tiếp là đóng account deletion/provisioning recovery/sensitive/archive integrity, rồi triển khai purchasing PR → approval → PO → nhận hàng liên kết sổ kho.
- Chưa commit/push/PR hoặc phát hành production; commercial release còn các gate nghiệp vụ, vận hành và IP/license.

---

## Wizard và activation nguyên tử — 22/10/2026

### Baseline / quyết định

- Tiếp tục cùng nhánh và baseline SHA đã ghi bên dưới; giữ working tree, chưa commit/push/PR hay phát hành ứng dụng production.
- Scope: hoàn thiện thiết lập doanh nghiệp có bản nháp/retry, command cấu hình nguyên tử và công cụ activation từ manifest. Mỗi doanh nghiệp vẫn có deployment/database riêng.
- Target cloud được kiểm tra là `tcjjhxqtreemccdbvyza`, manifest development, PostgreSQL 17.11; preflight có một tài khoản active, projects/items/warehouses trống, 55 migration. Không tạo Supabase project hoặc đổi credentials.

### Implemented changes

- `/system-admin/setup`: Doanh nghiệp → Thương hiệu → Module → Xác nhận; dùng DNA/component hiện có, chỉ có labels/status/data. Gateway/sidebar mở wizard khi đủ quyền, trang chỉnh Module riêng vẫn tồn tại.
- Bản nháp trình duyệt có schema, scope theo account/app/Supabase origin, lưu/tiếp tục/bỏ rõ ràng. Giữ baseline cũ khi server thay đổi; pending command và request ID tồn tại qua reload. Lỗi đọc server không xóa bản nháp; lỗi storage không gửi POST.
- Chung validators runtime cho ứng dụng và Node CLI, có declarations TypeScript. Giữ semantics legacy flags, chuẩn hóa ổn định để cùng body có thể retry qua reload.
- RPC `publish_system_settings_command`: active actor + quyền từng nhóm, CAS, advisory/row lock, idempotent receipt; settings/history/audit/receipt trong một transaction. RLS và ACL receipt chỉ cho service role đọc; ghi qua SECURITY DEFINER command.
- API activation có GET snapshot/value/version cùng query và POST bốn nhóm; không dùng presentation fallback để ghi. API không tin actor từ body. Lỗi commit không chắc chắn giữ request ID để retry và vô hiệu cache cũ.
- Các trang lưu một nhóm chuyển sang command khi migration tồn tại. Chỉ dùng giao thức cũ khi cả RPC lẫn receipt table được xác nhận chưa có; không fallback khi mạng lỗi, conflict hoặc rollout hỏng. Lỗi đọc lịch sử DB không thay bằng history in-memory.
- CLI activation mặc định preview local; prepare chỉ đọc và giữ các field ngoài manifest; apply xác minh reviewed plan/hash/target rồi gọi đúng một RPC. CLI prepare/apply chưa chạy cloud trong đợt này.

### Database rollout và bằng chứng

- Native PostgreSQL 17.10: **56/56 checks pass**, có hai connection, CAS một winner, simultaneous retry, reversed group order, rollback khi history/audit/receipt thất bại, permissions/RLS và default grant compatibility. Cluster tạm đã dừng; không thêm dependency vào package/lock.
- Sau preflight và dry-run xác nhận chỉ một migration, áp dụng **`202610210002_atomic_system_settings.sql`** vào DTech development. Hash trùng evidence integration, 56 migration trên cloud; không seed/role/bootstrap changes.
- Browser trước migration kiểm tra nút xuất bản bị khóa. Sau migration, publish qua UI giữ nguyên giá trị ngữ nghĩa (chỉ chuẩn hóa whitespace), tăng đúng một version cho bốn nhóm. Retry cùng body không tăng thêm; đổi body với request ID cũ hoặc dùng baseline cũ trả 409. Một receipt trên cloud, các counts projects/items/warehouses và active account giữ nguyên.
- Verified cloud: receipt RLS bật; service role SELECT/EXECUTE đúng, direct INSERT/UPDATE/DELETE bị thu hồi; anon/authenticated không execute command.
- [Native integration](evidence/atomic-settings-integration.json), [development rollout](evidence/activation-rollout.json), [QA đợt này](evidence/qa-p2-activation.json). Đây không phải production release hoặc UAT thương mại.

### QA

- **1.438 tests passed, 37 skipped**, 187 file pass và một file skipped. Đã sửa lỗi chuẩn hóa thứ tự flag legacy; hai timeout trong lần chạy song song với build được kiểm tra lại bằng full suite với bốn worker. Log cuối `.tmp/erp-p2-unit.log`.
- Full lint, typecheck và review build pass. Validate 56 migrations; scan **614 client artifacts, 0 secret matches**.
- Browser: 17 route quản trị +5 route regression, **20 route duy nhất** ở 1440/390px; wizard được kiểm tra cả bốn bước, lưu/tiếp tục/bỏ bản nháp và publish/retry/conflict thực. Không lỗi runtime/API ngoài các lỗi 401/409 được chủ động kiểm tra; không tràn ngang trong phạm vi đã duyệt.
- Login không có module list; hub không category filter/Dashboard; menu kho tập trung nghiệp vụ; OpenAPI theo branding; preview/testing production 404; anonymous config/activation 401.
- Source inventory hiện có 199 pages, 287 API files, 56 migration, 180 declared tables, 119 declared RPC names; fingerprint bao gồm MJS/MTS validators. Raw logs/screenshots chỉ ở `.tmp`.

### Completion / giới hạn

- DONE slice: wizard/browser draft, atomic activation/API/CLI, cache/history safeguards, development migration và acceptance nói trên.
- PARTIAL installer: chưa có server checkpoint, full Supabase stack rehearsal, upgrade/restore drill hay hai isolated deployments được nghiệm thu. Browser draft chỉ nằm trên thiết bị, có thể chứa liên hệ doanh nghiệp; xóa qua Bỏ bản nháp.
- Form chỉnh từng nhóm cũ dùng version đọc tại submit; wizard/CLI mới mang baseline từ lúc tải. SQL/operator ghi trực tiếp không có giao thức idempotency. CLI không invalidation cache liên process; TTL tối đa 30 giây vẫn áp dụng.
- P3 employee/offboarding/provisioning integrity và external/cron entitlement còn tiếp tục. Purchasing/Sales/GL/manufacturing chưa triển khai; không gọi hệ thống commercial-complete.

### Next small PR

Chuyển employee profile/offboarding/account disable/history sang command nguyên tử, có CAS, rollback, last-admin/session guards và native database tests; proposal hiện tại vẫn DRAFT, cần migration version mới. Sau đó triển khai purchasing PR → approval → PO → receiving theo kho hiện hữu.

---

## Đợt tiếp tục P1/P2 foundation — 21/10/2026

### Baseline và quyết định

- Tiếp tục working tree P0 trên cùng nhánh `feature/commercial-erp-p0-audit`, baseline SHA không đổi. Không commit/push/PR hoặc deploy production trong đợt này.
- Phạm vi: registry dùng chung, manifest khách hàng và dry-run local, cấu hình activation khi lỗi kết nối, metadata/OpenAPI trung lập. Giữ mô hình một deployment/Supabase riêng cho mỗi doanh nghiệp.

### Thay đổi đã làm

- Đưa module/catalog/preset vào `src/config/erpRegistry.json`, ứng dụng và công cụ triển khai cùng đọc. Giữ labels, quyền, route mappings và lựa chọn khách hàng cũ; không có Dashboard capability.
- Thêm manifest v1 và mẫu khách hàng may mặc; validate schema strict, URL/target, modules, origin, locale và cấm development seed. Hai project cũ được bảo vệ trong code, không thể bỏ guard qua manifest.
- `deployment:validate`/`deployment:plan` chỉ đọc manifest/source local, xuất fingerprint và preview đủ flag bật/tắt. `valid: true` không có nghĩa database đã cài hoặc có quyền truy cập.
- Configure/bootstrap/verify nhận manifest, môi trường và thông tin admin riêng; không mượn Supabase keys của instance khác. File secrets riêng nằm trong Git ignore; không chạy các công cụ kết nối này trong đợt phát triển.
- Sửa lỗi dotenv làm biến dạng mật khẩu chứa nháy/backslash; kiểm tra parse roundtrip trước khi ghi. Parser stdin trả lỗi cố định, không giữ đoạn JSON có thể chứa mật khẩu.
- Strict settings reader chặn khi DB lỗi/timeout, group module thiếu/sai hoặc credentials production thiếu. Cache xác minh tối đa 30 giây; không phục vụ module từ snapshot hết hạn. Có retry/coalescing, bảo vệ race publish/refresh và không gia hạn activation khi lưu giao diện.
- Reader hiển thị riêng cho layout/login giữ thương hiệu gần nhất hoặc default trung lập, tắt mọi module khi không xác minh được; API/authorization không dùng fallback này. Phiên ẩn danh vẫn thấy form đăng nhập.
- OpenAPI lấy tên từ branding doanh nghiệp sau kiểm tra quyền. Package/lock metadata và README chuyển sang DTech ERP; không đổi legacy offline keys, logo khách cũ hoặc account hiện hữu.

### QA evidence của đợt này

- **1.181 tests passed, 37 skipped**; 180 test files passed, 1 file skipped (181 tổng). Log `.tmp/erp-p1-unit.log`.
- Full lint/typecheck, review webpack build và kiểm tra thứ tự 55 migrations đều pass. Build vẫn ghi `system_settings.read_failed` khi static generation trong sandbox không truy cập DB; fallback chỉ phục vụ phần hiển thị, runtime đã kiểm tra kết nối thật qua API.
- Browser bản review 3100: 16 route quản trị + 5 route smoke, **19 route duy nhất**, mỗi route ở 1440/390px. Tất cả pass, không lỗi runtime/API hoặc tràn ngang trong phạm vi kiểm tra. Login không có modules, hub không filter/Dashboard, menu kho chỉ thuộc kho, settings API nhất quán, OpenAPI theo branding, preview/testing production 404 và anonymous configuration/OpenAPI bị chặn.
- Quét **612 client artifacts, 0 secret matches** bằng giá trị local, không ghi giá trị secrets vào báo cáo.
- Validate/plan DTech và plan khách hàng mẫu chạy local; không tạo project, áp migration, ghi settings hay bootstrap tài khoản. Mẫu không đại diện cho instance đã dựng.
- [QA của đợt P1/P2](evidence/qa-p1-foundation.json), [plan khách hàng minh họa](evidence/customer-plan.example.json), [hướng dẫn bộ cài](deployment-manifest-guide.md). P0 `qa-summary.json` giữ riêng, không cộng số trang cũ vào bằng chứng mới.
- Cập nhật inventory (bao gồm JSON source trong fingerprint), dependency inventory và CycloneDX SBOM. Browser screenshot/raw logs local trong `.tmp/erp-p1-*`; audit tạo/kết thúc phiên của chính nó, không tạo chứng từ nghiệp vụ.

### Completion status và giới hạn

- DONE cho slice này: registry chung, validated manifest/dry-run, target/admin parameterization, strict activation reads, OpenAPI/product metadata và các quality gates kể trên.
- PARTIAL P1: chưa có terminology dictionary đầy đủ theo ngành. PARTIAL P2: chưa có wizard/checkpoint, activation nhiều group nguyên tử hoặc nghiệm thu hai instance thật. Provisioning chưa là installer hoàn chỉnh.
- Settings/history/audit vẫn là nhiều bước; publish concurrent chưa có CAS nguyên tử. Atomic offboarding/provisioning cleanup, external/cron activation, real DB rollback/concurrency và UAT vẫn cần xử lý theo roadmap.
- Ba optional flags cũ giữ semantics tương thích; cài mới phải tạo đủ flags. Cache ở process khác có độ trễ tối đa 30 giây, chưa có invalidation liên process. Cấu hình activation chưa phải entitlement hợp đồng.
- Mua hàng, Sales/CRM, GL và sản xuất may vẫn chưa triển khai. Không nghiệm thu thương mại từ số test hoặc số trang.

### Next small PR

Hoàn thiện P2/P3 bằng command publish cấu hình nguyên tử có expected version/idempotency và activation customer settings trên staging, kèm rollback/concurrency tests. Sau đó áp dụng cùng pattern cho employee lifecycle, trước khi thêm chu trình PR/PO → nhập kho. Production migration, release/IP, backup/restore và UAT vẫn cần bằng chứng/phê duyệt vận hành tương ứng.

---

## Báo cáo P0 ban đầu

## Baseline

- Repository: workspace DTech; nhánh gốc `dtech-main`, SHA `3db5b84c6fee4d70433c7efea91e3fedea340f9d`.
- Working branch: `feature/commercial-erp-p0-audit`; giữ toàn bộ thay đổi đã có, chưa commit/push/PR.
- Scope: P0 + thay đổi nền tảng có phạm vi nhỏ theo yêu cầu UI trực tiếp.
- Environment: local dev 3000; review build `.next-review` tại 3100. Dữ liệu Supabase riêng hiện có được đọc qua ứng dụng; không tạo chứng từ thử.

## Audit Findings

- 198 page files, 286 API files, 55 migration, 179 declared tables, 117 declared RPC names.
- Có thể kế thừa HR/time/leave, kho, XNK, payroll và shared platforms; xem completion matrix.
- Thiếu PR/PO, CRM/sales, GL/AP/AR và manufacturing; không xem payroll là kế toán tổng hợp.
- Phát hiện atomic offboarding/account cleanup, threshold transaction/error propagation và mismatched route-area permissions.
- Chưa có root LICENSE/owner rights signoff; có dependency inventory + CycloneDX SBOM.

## Architecture & Decisions

- ADR-001: modular monolith; mỗi khách hàng deployment và Supabase riêng.
- Giữ route/API và dữ liệu khách cũ; không triển khai shared-DB tenancy.
- Dashboard compatibility routes giữ redirect; không có module Dashboard trong launcher.

## Implemented Changes

- Bỏ category filter; giữ tìm module và empty recovery.
- Bỏ tile/menu Dashboard; redirect legacy routes và normalize saved layout, cập nhật test theo hành vi mới.
- Module-focused sidebar/mobile/search; không lặp dãy ứng dụng.
- Bổ sung field mapping HR bị thiếu và date validation; giữ deployed DB command contract.
- Product export creator và payslip fallback trung lập; namespace Auth mới không đổi account cũ.
- Sửa các area gate thiếu permission chuyên biệt, không bỏ scope/domain guards.
- Bổ sung tiêu đề truy cập cho camera chấm công nhanh/cấu hình XNK; chặn trang UI preview trong production, giữ Design DNA ở khu vực quản trị.
- Thêm inventory generator, whole-site browser audit và 18 tài liệu P0/roadmap.
- Không áp dụng migration mới trong P0. SQL offboarding đề xuất là DRAFT ngoài active migrations.

## QA Evidence

- Baseline unit: 1036 passed, 18 failed, 37 skipped; assertion/mocks cũ được cập nhật theo yêu cầu mới.
- Full unit cuối: **1067 passed, 37 skipped** trong 176 test files (175 pass, 1 skipped).
- Lint và typecheck đã pass; review webpack build đã pass sau các sửa đổi cuối. Source migration validation: 55 file hợp lệ. Log local ở `.tmp/erp-*.log`; có log settings read timeout khi static build trong sandbox, xem tài liệu security.
- Review build crawl: đã duyệt **142/142 route tĩnh** ở 1440/390px. Đợt đầu có 140 pass và hai trang thiếu h1; hai trang đã sửa và tái kiểm tra thành công. Không thấy lỗi runtime/API nghiệp vụ hoặc tràn ngang trong các kiểm tra này. Screenshot/raw report local ở `.tmp/erp-site-review`; bản tóm tắt không chứa dữ liệu tài khoản ở `evidence/qa-summary.json`.
- Regression xác nhận: login không có danh sách module; hub không category filter/Dashboard; production `/ui-preview/erp` và `/testing` trả 404; API cấu hình trả 401 sau logout. Dev audit đầu bị nhiễu bởi streaming redirects/HMR được giữ là giới hạn công cụ, không tính thành lỗi nghiệp vụ.
- Chưa có UAT, hai-instance isolation, restore drill, role/device pilot hoặc real business posting/reconciliation evidence.

## Completion Status

- DONE: kiểm kê source/ADR/ma trận/roadmap; các thay đổi UI trực tiếp có code và unit coverage.
- PARTIAL: dynamic-record/business/cross-role browser acceptance, white-label toàn bộ artifacts, bộ cài generic và domain integrity. Kiểm tra 142 route tĩnh không chứng minh 46 template động hoặc workflow posting/UAT hoàn chỉnh.
- NOT IMPLEMENTED: purchasing/sales/GL/manufacturing vertical slices.
- BLOCKED cho Commercial Release: UAT, production configuration, backup/restore và commercial IP/license review chưa có bằng chứng.

## Risks & Safeguards

- Không công bố production-ready. Không xóa dữ liệu, đổi secrets, chạy production migration hoặc deploy production trong đợt này.
- Giữ customer DB branding và compatibility identifiers; secret/credential file không commit.
- Proposal RPC cần database integration tests trước activation; current deployed contract được giữ.

## Next Small PR

P1-brand-and-registry-neutralization: trung lập runtime terms/OpenAPI và kiểm tra representative screens/cross-role. Acceptance: generic instance không lộ brand cũ, persisted customer brand không bị ghi đè, quyền và output export không thay đổi ngoài metadata/default an toàn.
