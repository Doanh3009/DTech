# Design DNA và sitemap hiện hành

Chuẩn thực thi: [MASTER.md](../../design-system/dtech-erp/MASTER.md), [module contract](../erp/module-contract.md). Inter tiếng Việt, Lucide, token semantic/component và component dùng chung.

Luồng: `/login` → `/applications` → workspace của module → list/form/detail → command/approval → related documents/audit.

Yêu cầu trực tiếp được thực thi: login không có module; App Center bỏ bộ lọc nhóm; không có tile Dashboard; module không lặp dãy ứng dụng. Giữ tìm module không dấu, trạng thái rỗng, account/notification và “Tất cả module”.

Các entry cũ `/dashboard`, `/home`, `/workspace`, `/dashboard/*` có redirect tương thích. Không xóa backend analytics hoặc báo cáo nghiệp vụ.

Component: `ModuleHub`, `ErpModuleCard`, `AppShell`, `AppRail`, `MobileAppLauncher`, `PageHeader`, `DataTable`, `FormControls`, `StatusBadge`, `States`. Không đặt mô tả dưới từng action/menu/permission. Các ảnh audit ở `.tmp/erp-site-review` là bằng chứng local, không chứa trong package công khai.
