<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Bắt buộc về UI

- Không ghi nội dung mô tả dưới mỗi chức năng, action, permission hoặc mục điều hướng. UI chỉ hiển thị nhãn, trạng thái và dữ liệu cần thao tác; mô tả nghiệp vụ chi tiết đưa vào tài liệu/dev note khi cần.

## DTech ERP và module mới

- Trước khi thêm hoặc sửa UI module, đọc `design-system/dtech-erp/MASTER.md` và `docs/erp/module-contract.md`.
- Dùng component/token chung, lấy thương hiệu từ cấu hình; đăng ký module/quyền/route trong registry dùng chung.
- Theo yêu cầu 23/10/2026: khách hàng dùng chung project Supabase, dữ liệu và tài khoản tách theo doanh nghiệp (`tenant_id`). Gói ngành dùng cấu hình chung; không hardcode giao diện khách hàng. ERP nội bộ cũ giữ dữ liệu hiện tại; không cấp tài khoản khách vào luồng truy vấn toàn cục chưa có tenant scope.
