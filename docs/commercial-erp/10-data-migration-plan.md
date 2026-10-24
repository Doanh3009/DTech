# Migration không phá dữ liệu

Danh sách migrations hiện có trong `evidence/source-inventory.json`. Không sửa migration đã áp dụng; thay đổi sau này dùng forward migration có version.

Các bước: inventory/checksum nguồn → mapping IDs/relations → dry-run trên isolated staging → đối soát số dòng/ledger/file → role review → backup/restore evidence → phê duyệt cutover → verification và forward-fix.

Brand trong DB đã lưu không được thay bằng product default khi upgrade. Không đổi tên customer lịch sử, email Auth đang tồn tại, object key hoặc khóa IndexedDB làm mất hàng đợi offline. Namespace Auth mới là DTech; account cũ tiếp tục dùng email đã lưu.

Đề xuất employee profile/offboarding cũ đã được thay bằng migration `202610220001_atomic_employee_profile.sql`. Native PostgreSQL kiểm tra CAS, rollback, last-admin, quyền và các thao tác đồng thời; xem `evidence/atomic-employee-integration.json`. Migration mới chỉ thay/thêm command, không cập nhật hồ sơ hoặc tài khoản hiện có. Trạng thái rollout development và giới hạn còn lại ghi trong `progress.md` và [hợp đồng command](employee-profile-command-guide.md).

Migration `202610220002_account_lifecycle_recovery.sql` và `202610220003_atomic_employee_auxiliary.sql` đã áp dụng trên DTech development. [Bằng chứng rollout](evidence/lifecycle-rollout.json) ghi target, hash, dry-run và metadata trước/sau; không dùng việc tạo/xóa Auth hoặc archive admin thật để nghiệm thu. Bộ native có 165 kiểm tra trên schema nghiệp vụ thật cùng Auth stub, không thay thế rehearsal Supabase/GoTrue đầy đủ.

Đợt nâng cấp account lifecycle bổ sung bảng operation, quyền `account.delete` chỉ cấp sẵn cho role admin, các command và trigger bảo vệ Auth/session. Pause writer account cũ khi triển khai app và migration cùng đợt: service role không còn được gọi `provision_app_account` để bỏ qua reservation. Không phục hồi phiên bản app tự xóa Auth khi kết quả provisioning chưa rõ. Operation đang chờ phải được đối chiếu và tiếp tục/hủy rõ ràng; không sửa payload, fingerprint hoặc đổi request ID để bỏ qua trạng thái.

Sensitive patch và archive dùng `employees.row_version` chung với chỉnh sửa hồ sơ. Không tự điền lại version khi import hoặc retry xung đột. Archive giữ trạng thái lao động nhưng thu hồi tài khoản/phiên liên kết; sensitive history/audit chỉ lưu tên trường và version, còn dữ liệu gốc và lý do vẫn cần chính sách retention. Operation, tombstone và audit không có purge tự động trong đợt này. Xem [account recovery](account-lifecycle-recovery-guide.md) và [auxiliary command](employee-auxiliary-command-guide.md).

Code rollback và data rollback là hai kế hoạch riêng. Không rollback dữ liệu bằng DROP/reset.
