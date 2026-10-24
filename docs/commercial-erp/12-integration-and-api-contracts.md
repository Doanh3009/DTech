# API và liên thông

Nguồn: `src/app/api/v1`, `src/app/api/external/v1`, `src/features/integrations`, `src/features/search`, API inventory trong evidence.

API có schema/error envelope, pagination và permission; external routes có key/scope/idempotency. Webhook/retry/import jobs đã có nền tảng; chưa chứng minh hợp đồng với provider thật của khách mới.

Trong module, CommandPalette giới hạn command/recent/result theo route ownership và module đang bật; query dùng entity types của provider hiện có. Module chưa có provider chỉ có quick commands. `/applications` giữ tìm toàn hệ thống theo quyền.

Excel/PDF dùng font tiếng Việt và spreadsheet sanitization hiện có. P0 bỏ creator Châu Tuấn khỏi các workbook và lấy payslip fallback từ default settings; template customer truyền vào vẫn được ưu tiên.

OpenAPI lấy title từ branding đã lưu sau khi kiểm tra quyền. PATCH `/api/v1/employees/[id]` bắt buộc `rowVersion`, strict profile fields, cho phép null để xóa trường tùy chọn và trả `{employeeId,rowVersion}` sau một command DB; không đọc lại toàn bộ dataset hoặc ghi audit ngoài transaction. HTTP 409 hoặc kết quả mạng không xác định yêu cầu tải lại để đối chiếu, không tự rebase/retry. Xem [hợp đồng nhân sự](employee-profile-command-guide.md).

PATCH `/api/v1/employees/[id]/sensitive` và POST `/api/v1/employees/[id]/archive` cũng bắt buộc `rowVersion` chung với hồ sơ, lý do 3–500 ký tự và trả `{employeeId,rowVersion}`; archive thêm `profileStatus`. Sensitive patch giữ trường bỏ qua, null xóa trường và kiểm tra ngày sau merge. Mỗi command tự ghi history/audit trong DB. Xem [hợp đồng auxiliary](employee-auxiliary-command-guide.md). Migration `202610220002`/`202610220003` đã áp dụng trên development; bằng chứng tại [rollout](evidence/lifecycle-rollout.json).

| Account API | Request | Success data |
| --- | --- | --- |
| `POST /api/v1/employees/[id]/accounts` | `requestId` UUID, username, roleIds; password/loginEmail/loginPhone tùy chọn | `{requestId,accountId,employeeId,kind:"provision",state:"completed",temporaryPassword?}`; 201 |
| `DELETE /api/v1/accounts/[id]` | `{requestId}` | `{requestId,accountId,employeeId,kind:"delete",state:"completed"}` |
| `GET /api/v1/account-operations` | Không có body | `{operations:[...]}`; chỉ prepared/cleanup_required, đúng quyền hiện tại |
| `POST /api/v1/account-operations/[id]` | `{action:"resume"|"cancel",password?}` | Receipt completed/cancelled; mật khẩu tự sinh chỉ khi đủ điều kiện |

Account routes xác thực trước khi parse UUID/JSON và trả no-store. Không trả Auth UUID, fingerprint hoặc toàn bộ payload nội bộ. Provision không trả account DTO qua lượt đọc hậu commit; UI dùng receipt và refresh. Status PATCH trả `{accountId,status}`, roles PATCH trả `{accountId,roleIds}`. Deletion yêu cầu `account.delete`; provisioning có role khác employee cần thêm `account.assign_role`, được SQL kiểm tra lại khi recover.

Account provisioning/deletion giữ cùng request ID và body khi retry chưa rõ kết quả; không dùng quy tắc tự tăng version của employee CAS. Auth operation được reconcile theo reserved UUID; không tự bù bằng Auth DELETE. Lỗi validation sau khi reservation đã bền vững chuyển 409 để UI giữ payload/mật khẩu gốc trong bộ nhớ. Recovery panel tại `/settings/users` và tab Tài khoản nhân sự; inline không cần thêm `user.view` khi đã có quyền mở tab và quyền phục hồi. Xem [account lifecycle](account-lifecycle-recovery-guide.md).

Bộ native lifecycle có 165 kiểm tra với Auth stub. Mô phỏng service/browser không chứng minh GoTrue create/delete thật, email, Storage hoặc toàn bộ Supabase stack; các bước đó còn là gate rehearsal/UAT.

Tồn đọng: chuẩn bị i18n/currency dictionary, không tự tuyên bố đa tiền tệ hoặc tax compliance. Import onboarding cần preview/dry-run/row errors và đối soát trước commit.
