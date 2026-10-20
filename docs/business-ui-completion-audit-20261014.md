# Rà soát nghiệp vụ và UI — 14/10/2026

## Phạm vi và nguồn đối chiếu

Nhân sự/tài khoản, hợp đồng, BHXH, công–lương, phiếu lương và xuất báo cáo. Đối chiếu source đang làm với `docs/architecture/business-rules.md`, `docs/attendance-payroll-workflow.md` và các prompt V2 Đợt 01, 07, 08 đọc từ `git show HEAD:CT_NOIBO_ERP_V2_PROMPTS/...`. Những prompt đang bị xóa trong working tree được dùng làm tài liệu tham chiếu, không phục hồi hoặc thay đổi chúng.

Các tài liệu hợp đồng sản phẩm/UAT được prompt V2 trỏ tới trong `docs/erp-v2/` không có trong workspace. Báo cáo này không tự xác nhận các chính sách lương/phép/BHXH chưa được doanh nghiệp quy định.

## Cập nhật hoàn thiện — 15/10/2026

Các mục “Cần sửa” trong bảng ngày 14/10 phía dưới là phát hiện tại thời điểm rà soát đầu tiên. Những hạng mục đã xử lý trong source hiện tại:

| Hạng mục | Thay đổi | Bằng chứng mới |
| --- | --- | --- |
| BHXH | Service gọi một RPC để lưu hồ sơ và event cùng giao dịch; kiểm tra phiên bản `expectedUpdatedAt`. Trước khi dọn PDF sau lỗi phản hồi, service kiểm tra event đã commit. | `insurance/service.test.ts`: RPC duy nhất, từ chối phiên bản cũ/quyền thiếu, bù file khi chưa commit, giữ file sau phản hồi thất lạc, đọc đủ 501 hồ sơ và che tài liệu khi thiếu quyền. SQL nằm trong migration `202610140004_insurance_atomic_history.sql`; kiểm thử SQL/áp dụng DB do lượt triển khai riêng xác nhận. |
| Lịch sử BHXH | Mở theo từng nhân viên; lọc kỳ đóng; xem trạng thái đóng, lương đóng, tỷ lệ, khoản tham gia, người ghi nhận, lý do và tài liệu theo quyền. Nút chính dùng màu chữ thương hiệu; biểu mẫu giữ dữ liệu sau lỗi kết nối. | `InsuranceConsole.test.tsx`: dữ liệu lịch sử thật từ response, ẩn action khi capability thiếu, payload gửi đúng timestamp và phục hồi lỗi. |
| Hợp đồng | Tạo thủ công khi chưa có mẫu Word. Mẫu nằm trong drawer riêng. Có sửa metadata, thay PDF bằng `fileOnly`, lưu trữ bằng form có lý do. Cả sửa/thay file/lưu trữ gửi phiên bản đang hiển thị và dùng điều kiện CAS ở service. Lịch sử gắn “Hiện tại” vào đúng file đang được hợp đồng tham chiếu. | `OrganizationCatalog.test.tsx`, `EmployeeContractManager.test.tsx`, `contractService.test.ts`: payload thủ công không template, đúng phiên bản, không gửi metadata cũ khi chỉ thay file, chặn phiên bản cũ, phục hồi mất mạng. |
| File hợp đồng | Khi phản hồi tạo/thay file thất lạc, đọc lại hợp đồng trước khi xóa asset/object. Giữ object đã được commit hoặc chưa xác minh được; tránh xóa PDF đang được dùng. | Test service: giữ file sau commit, giữ file khi không đọc xác minh được, chỉ dọn file sau khi xác nhận update chưa gắn file. |
| Tài khoản | `catch/finally`, timeout và khóa lặp bằng ref; giữ form để thử lại. Không cho đóng form cấp tài khoản khi đang gửi. Lỗi clipboard không hiển thị nhầm “Đã sao chép”. | `EmployeeAccountActions.test.tsx`: phục hồi mạng, chặn gửi hai lần, thông báo copy thất bại. |
| Hồ sơ lương | Thêm/xóa có timeout, khóa gửi lặp và `finally`; giữ form khi lỗi. Có tải lại sau lỗi nạp ban đầu; chặn mở form khi chưa có danh sách nhân viên. | `SalaryConsole.test.tsx`: giữ giá trị khi ghi lỗi và tải lại nạp ban đầu. |

**36/36 test đạt, 7 file, 0 test bỏ qua**, report `.tmp/hr-finish-20261015.json`. Đây là test unit/component cục bộ với DB/fetch/storage giả lập; không gọi API ghi thật, không ghi DB test/production, không deploy trong bước này. ESLint cho 16 file HR/BHXH/hồ sơ lương đã kiểm tra đạt; TypeScript toàn workspace `tsc --noEmit --incremental false` đạt tại thời điểm chạy.

Phần còn cần nghiệm thu riêng: mutation SQL/RLS trên TEST, browser sau deploy, luồng hợp đồng Word/PDF qua storage thật và giao dịch tài khoản theo từng role. Phân trang hợp đồng/hồ sơ lương, giao nhận phiếu lương và lưu phiên bản mẫu Excel vẫn là giới hạn trong bảng gốc; không được suy ra rằng toàn hệ thống đã hoàn chỉnh. Quyết toán phép dư cuối năm theo **đơn giá ngày phép do Nhân sự nhập** đang do agent chính triển khai, không phải chuyển phép sang năm sau.

## Kiểm tra thực hiện trong lượt này

**69/69 test đạt, 17 file**, không bỏ qua test. Báo cáo máy đọc: `.tmp/business-ui-completion-audit-20261014.tests.json`.

- HR: schema hồ sơ, service nhân sự/tổ chức, repository nhân viên với dữ liệu DB giả lập.
- Công: công thức, cách trình bày, ma trận, danh sách kỳ, lịch, repository ngoại lệ và report repository với DB/storage giả lập.
- Lương: công thức, XLSX đọc lại bằng ExcelJS, PDF thật tạo trong bộ nhớ, ownership scope phiếu lương trên mobile.
- Không gọi API ghi, không đăng nhập tài khoản thật, không sửa production/test DB và không deploy.

Đây là test tự động cục bộ. Kết quả không thay thế UAT giao dịch thật, kiểm tra RLS hay kiểm tra browser mới của toàn bộ module.

## Kết quả theo module

| Module | Nghiệp vụ/UI hiện có | Bằng chứng | Kết luận và phần còn thiếu |
| --- | --- | --- | --- |
| Hồ sơ, role, tài khoản | Hồ sơ độc lập account; role thật từ DB; cấp account có compensation khi Auth/profile thất bại; RPC bảo vệ admin cuối cùng | Test HR đạt; `EmployeeDetailPage.tsx`, `employeeMutationService.ts`, `rolePersistenceService.ts` đã đọc | **Test cục bộ đạt; có lỗi UI tĩnh**: `EmployeeAccountActions.submitJson` thiếu catch/finally. Mất mạng có thể giữ trạng thái đang xử lý, không báo lỗi phục hồi. Chưa chạy lại role tùy chỉnh → cấp account → login/deny thật. |
| Hợp đồng | Tạo hợp đồng, upload/thay PDF, Word optional ở hồ sơ, lịch sử file, lưu trữ; API chặn quyền và lưu audit | Source `contractService.ts`, `EmployeeContractManager.tsx`, `OrganizationCatalog.tsx`; test schema/tổ chức đạt | **Cần sửa**: trang danh sách bắt buộc mẫu Word để tạo dù API hỗ trợ hợp đồng thủ công; chưa có action sửa metadata trong UI; cập nhật file gửi lại metadata cũ mà API không nhận expected rowVersion từ client. |
| BHXH | Đã có lương đóng, tỷ lệ, kỳ đóng, tình trạng đóng, khoản tham gia và lịch sử event trong API | Source `insurance/service.ts`, `InsuranceConsole.tsx`; UI fixture cũ theo tài liệu 13/10 | **Cần sửa**: UI không dùng lịch sử API; profile và event ghi thành hai request DB riêng. Lỗi ghi event để profile thay đổi nhưng API báo thất bại. Chưa có test tự động riêng hoặc fault injection cho chức năng này. |
| Bảng công | Từ attendance/worker/leave/ca/lịch; tổng hợp, ngoại lệ, điều chỉnh có lý do, khóa/mở với version và snapshot; ma trận/tháng/tuần, chi tiết ngày, pagination | Test công/report đạt; `.tmp/business-grid-audit/report.json` có 30 ca fixture, không request ghi hoặc lỗi | **Test cục bộ đạt; chưa xác nhận toàn bộ giao dịch thật trong lượt này**. UI chốt kỳ gọi API trực tiếp, chưa có confirmation như yêu cầu hành động nhạy cảm của V2. |
| Hồ sơ lương | Thêm mức hiệu lực, ghi nhận điều chỉnh, xóa bản chưa sử dụng, đọc lịch sử; quyền riêng | Source `SalaryConsole.tsx`, accounting service/schema | **Cần sửa UI**: thêm/xóa không busy guard hoặc catch/finally; click lặp có thể gửi hai lần, lỗi kết nối không hiển thị rõ. Danh sách lương/nhân viên chưa đọc đủ trang. |
| Bảng lương | Từ cùng kỳ công khóa/version; tính actual hoặc paid_time; sửa dòng có lý do, review/lock, mở lại, từng nhân viên có trang chi tiết | Test công thức/XLSX/PDF đạt; đọc `operate_payroll_period` và UI/API | **Đã có workflow trong source; còn giới hạn**. Lấy lương cuối kỳ, khấu trừ nhập sẵn; chưa tính tự động thuế, BHXH, OT hoặc lương đổi giữa kỳ. Không được gọi đây là bộ máy lương đầy đủ. Lock/publish UI chưa có confirmation. |
| Gửi/nhận phiếu lương | Gửi toàn kỳ hoặc riêng nhân viên, notification + chat; snapshot/version; self ownership; PDF; viewed và confirmed tách biệt; revoke/reopen | Test PDF/XLSX và mobile self scope đạt; đọc RPC publish/confirm và service | **Cần đối soát giao nhận**: publish thành công trước khi gửi notification/chat; lỗi sau publish có thể trả error nhưng retry không có luồng gửi lại. Chat helper bỏ qua lỗi ghi. Chưa có outbox/biên nhận giao nhận cho từng người. |
| Excel và mẫu xuất | XLSX thật, cell an toàn, thứ tự/nhãn cột, sheet/field theo quyền, link ảnh nội bộ; công snapshot và nguồn lớn đọc theo trang | Test ExcelJS/report repository đạt, gồm 1.050 ngày công trong mock | **Test định dạng/logic đạt; còn độ bền workflow**. Lưu mẫu và version snapshot không cùng transaction, lỗi ghi version bị bỏ qua. Các sheet lịch sử/phép đọc dữ liệu hiện tại ngoài snapshot tổng công. Chưa xuất/tải lại toàn bộ mẫu qua storage thật trong lượt này. |
| Quyền dữ liệu | Các API/service kiểm tra permission; payroll/payslip self scope; field export theo quyền; file private sau authorize | Source và test hiện có; `PayslipDetail.test.tsx`, `excelGenerator.test.ts`, `employeeService.test.ts` | **Chỉ xác nhận source/test cục bộ**. Chưa có ma trận allow/deny runtime mới cho tất cả HR/Finance/custom roles và từng signed file. |

## Lỗi cụ thể ưu tiên

1. **BHXH:** ghi profile + event nguyên tử; hiển thị lịch sử theo nhân viên/kỳ, người đổi, lý do và tài liệu. Không tự đặt tỷ lệ pháp lý.
2. **Hợp đồng:** mở luồng thủ công không phụ thuộc Word; thêm sửa metadata; truyền expected rowVersion và không ghi đè dữ liệu cũ khi chỉ thay file; thay browser prompt lưu trữ bằng dialog đồng bộ.
3. **Độ bền UI:** catch/finally và busy guard cho account, hồ sơ lương, hợp đồng; giữ form khi lỗi và cho retry.
4. **Độ đầy đủ dữ liệu:** phân trang hoặc đọc đủ trang trong BHXH, hợp đồng, salary, payroll totals/lines/payslips. Source hiện có SELECT không `.range`; nếu vượt giới hạn response DB, kết quả có thể bị cắt. Đây là phát hiện tĩnh, chưa đo dữ liệu lớn thật.
5. **Gửi phiếu:** trạng thái phát hành và trạng thái giao nhận phải tách rõ; có idempotency/retry cho notification/chat thay vì báo lỗi sau khi phát hành đã commit.
6. **Mẫu Excel:** lưu template + template version nguyên tử; test lỗi giữa hai bước và kiểm tra download signed/private theo từng role.

## Bằng chứng trước đó và giới hạn

- `docs/ui-interface-review-20261013.md` ghi kiểm tra UI fixture tại 320/390/768/1440, 708 test đạt. `.tmp/interface-audit/report.json` còn 84 ca/0 lỗi và `.tmp/business-grid-audit/report.json` còn 30 ca/0 lỗi/0 ghi. Đây là evidence cũ, không phải browser UAT mới của mọi workflow.
- `docs/attendance-payroll-workflow.md` ghi 17 ca E2E công–lương ngày 12/10. Report được trỏ tới trong `test-results/e2e/...` không còn đọc được trong workspace tại lượt này; chỉ ghi nhận kết quả lịch sử của tài liệu, không dùng làm PASS hiện tại.
- `docs/operations/deployment-20261013.json` chứng minh health/login production đã được kiểm tra, không chứng minh các giao dịch HR/lương đầy đủ.
- Không thấy bằng chứng đủ để tuyên bố toàn hệ thống hoàn chỉnh. Theo xác nhận mới của người dùng, phép dư cuối năm quy thành lương theo đơn giá do Nhân sự nhập, không chuyển sang năm sau; hạng mục này do agent chính triển khai và không được nghiệm thu bằng các test HR nêu trong báo cáo này.
