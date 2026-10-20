# Sửa nhập kho XNK và giao diện kho — 19/10/2026

## Quyền và dữ liệu TEST

- `import.test` / `qa_import` đã có quyền tạo/xem phiếu nhập nhưng thiếu `warehouse.view`, `warehouse.item.view`, và không có dòng phân quyền kho. Vì vậy các API tham chiếu của form bị chặn hoặc không có kho để thao tác.
- Bổ sung đúng hai quyền đọc tham chiếu, gán Kho chính `KHO-CHINH` cho tài khoản quản lý bởi bộ dữ liệu TEST. Cấu hình seed lưu `warehouseScopeCodes` để lần cấp dữ liệu sau không mất phạm vi.
- Sửa dữ liệu bằng SQL có guard bootstrap TEST, tài khoản, role không phải hệ thống, thành viên role và kho chính xác. Không reseed/reset; không thay đổi các bảng hàng hóa, tồn kho, chứng từ, lô hàng, nhân viên, lương; giữ 54 migration. Biên nhận: [xnk-warehouse-access-repair-20261019.json](operations/xnk-warehouse-access-repair-20261019.json).
- Session đọc quyền lại mỗi request; tải lại trang để cập nhật menu phía trình duyệt. Không yêu cầu đăng xuất.
- Không cấp quyền xuất kho, ghi sổ, quản trị kho hoặc kiểm kê cho XNK.

## Luồng nhận hàng

1. XNK chọn kho nhận được phân quyền thao tác, nhập số lượng và ngày nhận rồi lập phiếu nhập.
2. Mở phiếu nháp vừa tạo để sửa/lưu. Bộ phận kho ghi sổ phiếu đó để số lượng thực nhận/tồn kho được cập nhật.
3. Gửi lại cùng dữ liệu giữ mã yêu cầu chống trùng; lỗi đọc tiến độ nhận không bị biến thành số 0.
4. Phiếu liên kết lô hàng giữ nguyên hàng hóa, đơn vị và loại giao dịch nhập khẩu, không cho thêm dòng không có nguồn lô hàng. Vẫn có thể sửa số lượng, ngày, kho, ghi chú theo quyền.
5. Nút xem tồn kho dùng quyền `warehouse.view` và API vẫn lọc phạm vi kho. Bộ chọn kho nhận không hiển thị kho ngoài phạm vi thao tác.

## Giao diện

- Dải KPI kho có grid co giãn theo số ô; bỏ lớp nền trắng và viền vuông bao ngoài. Ô thống kê và bảng tiếp theo giữ bo góc chung.
- Cột thao tác tồn kho dành đủ chỗ cho Sổ kho / Nhập thêm cùng một hàng. Số lượng/đơn vị dài có thể xuống dòng trong ô riêng để tránh đè cột thao tác. Điện thoại dùng nút cao tối thiểu 44px.
- Nhập / xuất / chuyển là thao tác chính; kiểm kê chuyển xuống công cụ phụ thu gọn, sổ kho / điều chỉnh / kiểm kê nằm trong nhóm Đối soát kho.
- Không xóa kiểm kê hoặc lịch sử nghiệp vụ.

## Phạm vi kiểm tra

TypeScript và ESLint đạt. Build trước triển khai được ghi trong biên nhận phát hành. Không thêm/chạy bộ kiểm thử tự động, không tạo phiếu nhập hay thay đổi tồn kho để thử trong lượt sửa này.

Các API kho, hàng hóa, loại giao dịch và tham chiếu đã trả HTTP 200 khi đọc bằng `import.test` sau sửa quyền; danh sách kho của tài khoản chỉ có `KHO-CHINH`.

## Ô tìm kiếm

Sửa tập trung tại `interaction-finish.css`: reset border, outline, shadow và radius của input lồng trong SearchInput cho cả hover/focus/focus-visible. Chỉ khung ngoài nhận focus ring chung, có outline hệ thống trong chế độ forced-colors. Không tắt focus của các ô nhập khác.
