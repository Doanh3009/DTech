# Hợp đồng module ERP

Đọc [Design DNA](../../design-system/dtech-erp/MASTER.md) trước khi viết UI. Xem component tại `/system-admin/design-dna`.

## Cấu trúc và đăng ký

1. `src/features/<module>/`: components, pages, schemas, services, types. Routing ở `src/app/(app)/<module>` và `src/app/api/v1/<module>`; schema database ở migrations.
2. Thêm capability và gói ngành vào `src/config/erpRegistry.json`, cập nhật schema/default `modules` tương ứng. `erpModules.ts` xuất keys/catalog từ registry, CLI triển khai dùng cùng nguồn. Định nghĩa hành vi nâng cấp; module mới có dữ liệu nhạy cảm nên mặc định tắt.
3. Đăng ký quyền, `permissionPrefixes`, `moduleForApiPath` và `moduleForPath`. Endpoint khác tên namespace phải được ánh xạ đầy đủ.
4. Thêm permission vào type/catalog và role migration. Service/RPC kiểm tra quyền cụ thể và phạm vi dữ liệu.
5. Đăng ký application trong `moduleRegistry`, icon/màu trong `moduleIconRegistry`, menu trong `navigation`, khu vực trong `routeAccess`, metadata trong `routeRegistry`.
6. UI route dùng `ProtectedAreaLayout`; API dùng `getRequestUser` và `requirePermission`. Không dùng session resolver trực tiếp để bỏ qua capability.
7. Chỉ thêm vào gói ngành khi nghiệp vụ chạy được. Module dự kiến nằm trong `plannedModules`, không tạo link khả dụng.

Authorization và nghiệp vụ dùng strict `readSettingsGroup`/`readSystemSettings`. `readPresentationSettings` dành riêng layout/login khi cần fallback hiển thị; không dùng kết quả đó để cấp quyền hoặc công bố cấu hình.

ERP khách dùng chung project theo [kiến trúc tenant](shared-project-architecture.md) có miền truy cập riêng: `/erp/[slug]`, API `/api/v1/business/[slug]`, registry `businessIndustries.json`/`businessEntities.json`, session business và RPC `business_*`. Không dùng `getRequestUser` hay quyền admin nội bộ để cấp truy cập khách. Slug trên URL chỉ xác định đích; RPC suy ra tenant từ session và kiểm tra slug, quyền, module, trạng thái và hạn dùng. Component/token vẫn tuân thủ cùng Design DNA. Command nhiều chứng từ cần nguyên tử, có request UUID và receipt; xem [giao hàng theo đơn](sales-fulfillment.md).

## UI

Dùng `PageHeader`, form/bảng/bộ lọc/thanh hành động và trạng thái chung. CSS riêng chỉ sở hữu nội dung nghiệp vụ. Màu, chữ, khoảng cách và hình khối lấy từ token. Không hardcode tên doanh nghiệp hoặc chép stylesheet trang khác.

Không ghi mô tả dưới từng chức năng, action, permission và menu. Quy tắc nghiệp vụ nằm trong tài liệu. Dữ liệu demo phải được đánh dấu và không ghi vào dữ liệu production.

Danh sách module chỉ xuất hiện tại gateway sau đăng nhập. Khi vào module, sidebar, menu điện thoại, breadcrumb và tìm kiếm bám nghiệp vụ của module hiện tại. Dashboard riêng của module được giữ trong cùng phạm vi. Dùng liên kết “Tất cả module” để quay về gateway; không nhúng `ModuleLauncher` hoặc lặp dãy ứng dụng trong trang nghiệp vụ.

## Dữ liệu

Schema có khóa liên kết, ràng buộc, index, audit và kiểm soát trạng thái. Giao dịch nhiều bảng nguyên tử ở RPC/service. Chứng từ đã ghi sổ có luồng đảo/điều chỉnh. UI dùng read model/service để truy cập nghiệp vụ khác. Import/export tuân thủ cùng quyền và quy tắc.

## Nghiệm thu

Kiểm tra người có/không có quyền, module tắt, deep link/API trực tiếp, lỗi ghi và thử lại. Luồng liên module phải xét module đích bị tắt. Typecheck, build và test nghiệp vụ cần qua; soát màn hình 390/768/1440px, bàn phím và reduced motion.
