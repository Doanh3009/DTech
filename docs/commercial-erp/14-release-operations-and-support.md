# Release, hỗ trợ và vận hành

Nguồn hiện có: `docs/operations/{deployment,backup-restore,production-readiness,security-runbook}.md`, `docs/go-live`, health endpoints và system-admin operations.

Release nhỏ, migration expand/contract, preview plan và config snapshot. Không dùng customer fork; preset chỉ là cấu hình. Support diagnostics phải tránh secret/PII; operator không tự có quyền xem dữ liệu mọi khách hàng.

Chưa có bằng chứng production target, restore drill, scale benchmark, customer migration rehearsal, signed UAT hoặc support SLA của sản phẩm chung. Chưa công bố Commercial Release.

Operator/customer admin: dùng runbook hiện có để cấu hình, cấp quyền, nhập dữ liệu, health và backup; P2 sẽ chuẩn hóa installer/onboarding. End-user: hướng dẫn hiện có ở `docs/user-guide` cần rà theo từng role trước bàn giao.

Contract offboarding: giữ quyền owner export theo scope, dữ liệu và private object; đối soát package trước revoke/xóa theo chính sách được duyệt. Chưa có command customer:export được nghiệm thu nên không quảng bá command đó.
