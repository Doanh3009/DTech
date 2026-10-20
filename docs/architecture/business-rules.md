# Business rule index

- Disabled/locked/unprovisioned account không có session hợp lệ; role/status được kiểm tra server-side.
- Sensitive employee field, photo, file và export cần quyền + domain scope; không gửi rồi CSS-hide.
- Individual attendance và worker attendance là nguồn riêng; idempotency ngăn ghi trùng.
- Approved leave tác động official leave ledger; không sửa balance trực tiếp.
- Locked timesheet không được mutate nếu chưa unlock có quyền/audit.
- Posted warehouse document immutable; correction dùng reversal/adjustment. Ledger là nguồn biến động, balance là projection.
- XNK partial receipt không vượt remaining quantity; receipt đã post tạo warehouse movement.
- Approval dùng workflow/version snapshot; không đổi lịch sử khi config mới có hiệu lực.
- File object key do hệ thống sinh; signed URL ngắn hạn chỉ sau authorization.
- Webhook/import/job retry phải dùng idempotency key; singleton operations có unique running lock.
- Migration không merge employee theo tên, không migrate password, không fake historical events.
