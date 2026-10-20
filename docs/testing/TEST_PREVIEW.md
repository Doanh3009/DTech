# Bảng tài khoản test trên Vercel

Bản khoảng đệm công trường ngày 19/10/2026: **READY** `dpl_9QYHCfdU3r22ickwvcDdQsRSQQvb`, [mở bản test](https://ct-noi-bo-test-chau-tuan.vercel.app). Source digest `f360c94f8c9b44d39a7ac47ceff7da0a5f0393b3fd2111807e61bb71d596bd84`. Khung ngoài chừa 16px desktop/12px mobile, các phần cách nhau 12px, header/tab/nội dung có viền mảnh bo góc; bỏ hàng “Đã đồng bộ” khi không có việc chờ gửi.

TypeScript, focused ESLint và build Vercel đạt; health live/ready 200. Không đổi dữ liệu hoặc nghiệp vụ, không chạy browser/bộ test tự động. [Biên nhận](../operations/project-workspace-spacing-deployment-20261019.json), [phạm vi](../project-workspace-spacing-20261019.md).


Bản giao diện chung, quyền Nhân sự và gửi phiếu lương ngày 19/10/2026: **READY** `dpl_8eNxKWeHuVmceeYyXh276wv9eUf4`, [mở bản test](https://ct-noi-bo-test-chau-tuan.vercel.app). Source digest `f38aebe96e879defd1603e10c8cc0fd5f2df28e23be49e1817511cf8b808fe72`. Đồng bộ thanh tìm kiếm/lọc, nút và bo góc; hoàn thiện đầu gói/công trường và thao tác tạo theo quyền; gửi phiếu có bộ chọn tài khoản thật, trạng thái phát hành/giao phiếu riêng và mở trực tiếp từ danh sách kỳ đã duyệt.

Sửa quyền Nhân sự: thu hồi bốn quyền quản trị cấp dư trên TEST, hộp duyệt nghỉ chấp nhận quyền LEAVE đúng bước được giao. TypeScript, ESLint, build 288 trang đạt; health live/ready 200; ba API inbox HR 200, API roles 403; đọc đủ 13 kỳ/80 dòng lương, 68 dòng có tài khoản hoạt động. Không gửi phiếu thật, không chạy browser/bộ test tự động; giữ 54 migrations, dữ liệu nghiệp vụ và production. [Biên nhận](../operations/unified-interface-deployment-20261019.json), [phạm vi và luồng](../unified-interface-roles-payroll-20261019.md), [repair quyền](../operations/hr-role-access-repair-20261019.json).


Bản thanh công cụ gọn ngày 19/10/2026: **READY** `dpl_F76k2GiLXGGHcSnLzoiNB6C2ZNaf`, [mở bản test](https://ct-noi-bo-test-chau-tuan.vercel.app). Source digest `2700fb5ef0955ba5074671977c262aeadda7db322832cd2065137de7d59c9464`. Thanh trên một hàng: điều hướng trái, tìm kiếm/tài khoản phải; chữ desktop 13px, cao 56px, nút Kiểm thử mở popup thay vì chiếm hàng trong nội dung. Giữ màu hiện tại; màn hình hẹp thu gọn nhãn và giữ vùng chạm 44px.

TypeScript, ESLint và build đạt; health live/ready trả 200. Chưa chạy browser/test tự động trong lượt này. Không đổi database/nghiệp vụ/production. [Biên nhận](../operations/header-toolbar-deployment-20261019.json), [phạm vi](../header-toolbar-compact-20261019.md).

Bản kho/XNK và ô tìm kiếm ngày 19/10/2026: **READY** `dpl_ByjvT3femuCcBBCbWBaGTEvv7oPx`, [mở bản test](https://ct-noi-bo-test-chau-tuan.vercel.app). Source digest `7280616447f6f24e14195385886ba44c09c8120a885b86a39f7e444bb16935db`. Sửa quyền đọc danh mục và phân Kho chính cho XNK test, bộ chọn kho nhận theo phạm vi, lập phiếu nhập mở đúng phiếu nháp; bộ phận kho ghi sổ để cập nhật tồn. Bỏ nền trắng dư của KPI, giữ thao tác tồn kho cùng hàng, thu gọn kiểm kê và sửa focus chồng viền của ô tìm kiếm.

TypeScript, ESLint và build đạt; 5 API dữ liệu form trả 200 bằng `import.test`, health live/ready trả 200. Giữ 54 migration, không tạo phiếu thử hoặc thay số tồn, production không thay đổi. [Biên nhận triển khai](../operations/xnk-warehouse-deployment-20261019.json), [biên nhận sửa quyền](../operations/xnk-warehouse-access-repair-20261019.json), [phạm vi và luồng](../xnk-warehouse-usability-20261019.md).

Bản tinh gọn chấm công ngày 19/10/2026: **READY** `dpl_CpVq1jW3Wrgdpu2cjTvTZPBtWLHT`, [mở bản test](https://ct-noi-bo-test-chau-tuan.vercel.app). Source digest `c52311785f4512cca5e2fd1c22e2f081146bbc83bb6154ffb185880918dbb662`. Mở camera trực tiếp, chụp tự ghi nhận, bỏ mốc tham chiếu, giữ giờ chụp khi chờ GPS/mạng và tự đồng bộ trên màn Cá nhân. Chỉ xác định thiếu lượt ra sau giờ kết thúc ca. GPS không khả dụng được lưu để Nhân sự rà soát, không giả tọa độ.

TypeScript, ESLint và build đạt; health live/ready trả 200. Không có migration, production giữ nguyên. Chưa kiểm tra GPS trên điện thoại thật hoặc chạy bộ kiểm thử tự động trong lượt này. [Biên nhận](../operations/attendance-capture-deployment-20261019.json), [luồng và giới hạn](../attendance-capture-streamline-20261019.md).

Bản kho và công trường ngày 17/10/2026: **READY** `dpl_4RnUm8dprL3SFqNGVdYcEfUxvKRW`, [mở bản test](https://ct-noi-bo-test-chau-tuan.vercel.app). Source digest `df6fb71e259751b39dafdf89ae744167a7b2dcb1cb809d400d20cf58219800ed`; database TEST có **54 migration**. Hoàn thiện nhập/xuất/chuyển/kiểm kê, tổng quan kho, vật tư theo công trường, sửa địa điểm/GPS và điều hướng điện thoại giữ công trường đang chọn. Luồng lương đã rút gọn trước đó được giữ nguyên.

Kiểm tra: TypeScript, ESLint và build đạt; **49 kiểm tra SQL trước và 49 sau migration**, 57 trạng thái fixture, **50 trạng thái browser live**, 6 trạng thái chuyển trang với chuyển động bình thường, 18 kiểm tra API kho/công trường/quyền và 26 kiểm tra health/alias/API. Dữ liệu nghiệp vụ cũ và production giữ nguyên `dpl_Hz1TzXrL9sR9yEzXUeMiFZRBUbDK`. [Biên nhận](../operations/warehouse-construction-deployment-20261017.json), [luồng và giới hạn](../warehouse-construction-completion-20261017.md).

### Lịch sử

Bản rút gọn luồng lương ngày 17/10/2026: `dpl_D551TTv9te4eAqBUyEpAAjcKYRPa`, 53 migration; 1018 unit test đạt trong lần triển khai đó. [Biên nhận](../operations/payroll-simple-deployment-20261017.json), [luồng lương](../payroll-simple-workflow-20261017.md).


Bản 17/10/2026 trước rút gọn luồng lương: `dpl_GrGWNUuq9SDA1zJPtSeYuSyY4CMr`, 52 migration; hoàn thiện sidebar, biểu đồ, phiếu lương và hàng đợi gửi phiếu. [Biên nhận](../operations/accounting-completion-deployment-20261017.json).

Bản ngày 16/10/2026: `dpl_A9T58R3ReyHr7iBT41yruSCYhfAn`, 51 migration; chi tiết/quá trình đóng BHXH và bảng công danh sách. [Biên nhận](../operations/insurance-timesheet-deployment-20261016.json).

Bản ngày 15/10/2026: `dpl_8gCwv5ALi82pqsRSKBuHUUekBwhk`, 50 migration; sửa PDF/Excel, địa chỉ và thao tác điểm danh. [Biên nhận](../operations/usability-files-deployment-20261015.json).

Bản nghiệp vụ trước ngày 15/10/2026: `dpl_CKA5WcXq8JTzB8ihJYF9EUTuvoHT`, 49 migration; gồm quy đổi phép dư thành lương và lịch sử BHXH. [Biên nhận](../operations/business-deployment-20261015.json), [phạm vi nghiệp vụ](../business-review-20261015.md).

Bản nghỉ phép ngày 14/10/2026: `dpl_9HqowjSdyH8sXJPNWtvuqgZiBKAg`, 46 migration. Báo cáo: [leave-deployment-20261014.json](../operations/leave-deployment-20261014.json).

Bản chấm công/đăng nhập ngày 14/10/2026 trước cập nhật nghỉ phép: `dpl_Ezoe2NS53eJfk3KTXyHKFvUhMGJn`; build sinh 282 trang, 45 migration. Báo cáo: [test-deployment-20261014.json](../operations/test-deployment-20261014.json).

Bản ngày 12/10/2026: `dpl_7d7ocXNuPnwETMG617PCrVpXSoUN`. Build và TypeScript thành công, sinh 282 trang. Phiên Edge mobile ở 390px xác nhận `/login` trả 200 không qua đăng nhập Vercel, bảng 10 tài khoản và đăng nhập test trả 200, menu mở/đóng đúng và không tràn ngang/lỗi JavaScript. Giao diện local đã kiểm tra thêm ở 375px và 430px.

### Triển khai Preview

Trang `/testing` hiển thị 10 tài khoản theo vai trò. Bấm dòng hoặc nút `Vào test` sẽ tạo phiên đăng nhập thật qua Supabase Auth. Dữ liệu được lưu trong database `CT_NoiBo_Test` (`lgmlkagcytfjazulgfbz`).

Môi trường Vercel Preview dùng `APP_ENV=test`, `RELEASE_ENVIRONMENT=test` và `TEST_TOOLS_ENABLED=true`. Cấu hình được lấy từ `.env.e2e.local`; các khóa và mật khẩu được truyền qua stdin, không xuất ra console. Project hiện triển khai bằng CLI nên các biến được giới hạn theo môi trường Preview thay vì nhánh Git.

Bản test hiện tại đã được cấu hình database và credentials riêng; marker `RELEASE_ENVIRONMENT=test` đã là biến config có thể đọc lại. Khi cập nhật giao diện, kiểm tra cấu hình hiện có rồi deploy Preview mới.

```powershell
node scripts/testing/deploy-preview.mjs plan
node scripts/testing/deploy-preview.mjs inspect
node scripts/testing/deploy-preview.mjs dry
vercel deploy --yes --scope team_P6ZUPEQGflrU8soIrX7UPUVD --regions sin1
node scripts/testing/deploy-preview.mjs public <READY_PREVIEW_DEPLOYMENT_ID>
```

Lệnh `configure` dành cho lần thiết lập đầy đủ Preview mới: nó tải toàn bộ biến test lên Vercel. Lệnh `configure-public-marker` chỉ đặt marker `RELEASE_ENVIRONMENT=test` khi môi trường chưa có marker config. Không cần chạy lại các lệnh cấu hình này cho mỗi lần deploy.

Lệnh `public` chỉ nhận deployment READY thuộc project này, môi trường Preview tiêu chuẩn và database test `lgmlkagcytfjazulgfbz`. Helper kiểm tra `APP_ENV=test`, `RELEASE_ENVIRONMENT=test`, `TEST_TOOLS_ENABLED=true`, các URL database và dấu kiểm tra khóa production bằng API trong bộ nhớ; không xuất giá trị cấu hình ra console. Mọi biến test phải chỉ áp dụng cho Preview và được cấu hình trước khi deployment được tạo. Khi biến đã thay đổi sau deployment, phải deploy Preview mới trước khi mở công khai.

Alias cố định `https://ct-noi-bo-test-chau-tuan.vercel.app` được trỏ đến Preview đó rồi thêm riêng một Deployment Protection Exception qua API `{ override: { scope: "alias-protection-override", action: "create" } }`. Alias công khai mở trực tiếp trên điện thoại, không yêu cầu tài khoản Vercel. Cấu hình bảo vệ toàn project không bị thay đổi. Vercel công bố [Deployment Protection Exceptions miễn phí trên mọi gói từ ngày 09/09/2026](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan); body API được xác định từ [Vercel OpenAPI](https://vercel.com/openapi.json).

Link `/testing` trong file truy cập riêng chứa lời mời tester có chữ ký trong fragment, gắn với database và môi trường test, có hiệu lực bảy ngày. Lời mời hiện hết hạn lúc 15:50 ngày 26/10/2026 (Asia/Saigon). Link công khai không chứa `_vercel_share`. Trình duyệt xóa fragment rồi đổi sang cookie HttpOnly tám giờ. Người dùng không cần nhập mật khẩu từng tài khoản. Alias vẫn công khai khi lời mời tester hết hạn; chạy lại `public` với deployment hiện tại để cấp lời mời mới. Helper giữ nguyên exception công khai đã có khi chạy lại.

Nếu cần link có giới hạn thời gian truy cập ở lớp Vercel, vẫn có thể dùng lệnh cũ:

```powershell
node scripts/testing/deploy-preview.mjs share <READY_PREVIEW_DEPLOYMENT_ID>
```

Lệnh `share` kiểm tra project, trạng thái READY và quyền sở hữu alias trước khi tạo link. Vercel cấp shareable link cho riêng alias preview trong bảy ngày; query `_vercel_share` giúp vào alias đang được bảo vệ. Trên alias đã mở công khai bằng `public`, shareable link không đóng lại quyền truy cập công khai.

Link được lưu trong `.tmp/testing-preview-access.private.json`. Đây là thông tin truy cập riêng: `.tmp`, `*.private.json`, các file `.env` và cache được loại khỏi Git hoặc gói triển khai. Có thể cấp lại link sau khi hết hạn. Helper từ chối mở công khai hoặc chia sẻ deployment production và API test trả 404 khi môi trường test không hợp lệ.



