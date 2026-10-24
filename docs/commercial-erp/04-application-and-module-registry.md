# Registry ứng dụng và capability

Nguồn: `src/config/moduleRegistry.ts`, `erpModules.ts`, `moduleIconRegistry.ts`, `navigation.ts`, `systemSettings.ts` và `routeAccess.ts`.

- Application: entry UI, route ownership, icon, nhóm nghiệp vụ.
- Capability: 9 flags hiện có; industry preset chỉ tạo bản nháp khi người có quyền áp dụng.
- Activation: đã lưu trong nhóm `modules`, có version/audit qua settings service.
- Permission: quyền account từ role; bật module không tự cấp thêm quyền.
- Scope/state: domain service/RPC chịu trách nhiệm.
- Entitlement hợp đồng/license: **chưa triển khai**, không coi flags activation là license.

Dashboard compatibility entry có `launcher: false`; đường dẫn cũ redirect về `/applications` hoặc domain tương ứng. App Center chỉ hiển thị ứng dụng được bật và được cấp quyền. Sidebar/menu điện thoại/tìm kiếm trong module theo cùng route ownership.

Giữ URL hiện tại. Không thêm `/apps/sales` hoặc `/apps/purchasing` cho tới khi slice có API, data, permission, workflow và tests.
