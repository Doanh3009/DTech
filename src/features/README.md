# Feature Modules

Các module nghiệp vụ phát triển độc lập nhưng dùng chung routing, AppShell, permission, API utilities và design system.

Mỗi module nên giữ cấu trúc:

```text
pages/
components/
hooks/
api/
schemas/
types/
utils/
```

Đọc [Design DNA](../../design-system/dtech-erp/MASTER.md), [hợp đồng module](../../docs/erp/module-contract.md) và [kiến trúc ERP](../../docs/erp/platform.md) trước khi bổ sung module. Catalog/gói ngành nằm trong `src/config/erpModules.ts`; tính năng dự kiến không đăng ký thành module đang hoạt động.
