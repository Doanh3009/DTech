# Luồng lương rút gọn — 17/10/2026

## Thao tác

1. Nhân sự chốt kỳ công.
2. Hệ thống tự tạo hoặc cập nhật bảng lương từ kỳ công đã chốt. Kế toán thấy bảng lương trong danh sách cần xử lý.
3. Kế toán xem chi tiết, chỉnh lương/phụ cấp/thưởng/khấu trừ nếu cần rồi bấm **Duyệt lương**.
4. **Xuất Excel** để trình sếp. File có phần ký người lập, kế toán và giám đốc.
5. **Duyệt phiếu lương** mở dropdown: gửi tất cả hoặc tìm/chọn từng nhân viên.

Không còn màn hình năm bước, checkbox kiểm tra, thao tác tạo bảng lương và chuyển công sang lương thủ công. Các trạng thái kỹ thuật cũ vẫn được đọc để tương thích dữ liệu hiện có.

## Quy tắc dữ liệu

- Chốt công ghi hàng đợi trong cùng giao dịch; API xử lý ngay sau đó. Worker PostgreSQL mỗi phút tiếp tục xử lý khi yêu cầu bị gián đoạn. Lỗi thiếu dữ liệu được thử lại sau năm phút.
- Thiếu hồ sơ lương hoặc có hai kỳ công cùng tháng: giữ công đã chốt, báo tình trạng cần xử lý; không ghi đè bảng lương của kỳ công khác.
- Duyệt lương kiểm tra nguồn công, hồ sơ lương, số tiền và phiên bản trong một giao dịch. Không tự tạo/gửi phiếu khi duyệt lương.
- Sửa bảng lương đã duyệt nhưng chưa gửi: tự mở để chỉnh, xóa dấu duyệt trước và yêu cầu duyệt lại. Gửi rồi thì phải mở lại điều chỉnh bằng thao tác riêng, có lý do và lưu lịch sử thu hồi.
- Dropdown gửi tất cả chỉ xử lý phiếu còn thiếu. Gửi từng người chỉ tạo phiếu cho người đó. Gửi lại thông báo sử dụng phiếu hiện có, không sinh phiên bản lương mới.
- Phiếu và hàng đợi thông báo được ghi nguyên tử; thiếu tài khoản nhận phiếu thì chặn gửi. Trạng thái lỗi/đang gửi/đã gửi được giữ riêng.
- Không thay đổi công thức công, các khoản lương hoặc khoản quy đổi phép dư đã có. Không tự tính đơn giá phép thay Nhân sự.

## Kiểm tra

- 36 kiểm tra trước migration và 39 kiểm tra sau migration trên PostgreSQL thật trong giao dịch **ROLLBACK**, gồm lỗi duyệt giữa chừng, xung đột phiên bản, sửa sau duyệt, khôi phục hàng đợi, gửi từng người/tất cả và giữ nguyên snapshot cũ.
- 40 trạng thái giao diện bằng component thật, API giả cô lập, ở 320/390/768/1440 px. Kiểm tra cả tên dài, tìm người nhận, giữ nội dung khi lưu lỗi và duyệt lại sau chỉnh sửa.
- Ảnh và số đo: `ui-evidence/payroll-simple-20261017/local/report.json`.
- Migration TEST: `202610170001_payroll_simple_approval.sql`; dữ liệu cũ giữ nguyên, không backfill gửi phiếu hoặc tính lại lương cũ.
- Giới hạn: chưa kiểm tra tranh chấp khóa bằng hai phiên SQL đồng thời hoặc thiết bị di động vật lý. Thao tác nghiệp vụ khi audit bản đã deploy được chặn; các ca ghi dữ liệu dùng fixture cô lập và giao dịch rollback.

Biên nhận triển khai: `operations/payroll-simple-deployment-20261017.json`.

## Bản TEST đã triển khai

- URL: https://ct-noi-bo-test-chau-tuan.vercel.app
- Deployment: `dpl_D551TTv9te4eAqBUyEpAAjcKYRPa`; source digest `e15516b17302a1ea83bb6c2470bbcff78d857a97eb408d23924ae3b5725b721e`.
- 1.018 test đạt, 0 thất bại; 37 ca live opt-in không bật. TypeScript, ESLint và build đạt.
- 32 trạng thái giao diện kế toán và 4 trạng thái Nhân sự trên bản deploy; không tràn trang hoặc lỗi JavaScript/API nghiệp vụ. Kiểm tra thêm số tiền không bị ngắt dòng trên desktop.
- File Excel thật tải từ tài khoản kế toán đã được đọc lại, đối chiếu dòng lương và phần ký duyệt.
- Không thay đổi production.
