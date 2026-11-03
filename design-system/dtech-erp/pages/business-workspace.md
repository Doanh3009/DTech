# ERP khách hàng — hoàn thiện giao diện

Phạm vi: `/erp/[slug]`, giao diện dùng chung cho các gói ngành. Kế thừa MASTER.md; thương hiệu, tài khoản và dữ liệu lấy từ cấu hình/phiên hiện có.

## Hướng thiết kế

- Header gọn: thương hiệu/doanh nghiệp, tìm kiếm theo module, tài khoản. Một dòng breadcrumb nhận diện module và nghiệp vụ hiện tại.
- Sidebar chỉ chứa module hiện tại, chia Chứng từ / Danh mục / Chi tiết từ registry. Tìm nghiệp vụ không phân biệt dấu tiếng Việt; thể hiện mục đang mở.
- Danh sách ưu tiên mã/tên, trạng thái và trường có ích; cho chọn thêm cột. Số lượng/bộ lọc là dữ liệu thật. Bảng chuyển sang thẻ trên điện thoại, giữ nút mở và thông tin chi tiết.
- Form chia nhóm theo trường thực tế. Thanh lưu/đóng nằm ngoài vùng cuộn. Không lưu khi chỉ xem trước giao diện.
- Phần hành dùng chung tab hỗ trợ bàn phím. Bộ lọc, số liệu, bảng và phân trang có thứ bậc thống nhất. Số tiền dài có dạng gọn và giá trị đầy đủ để đối chiếu.
- Không dùng gradient, mô tả dưới chức năng/menu, KPI giả hoặc dữ liệu giả bổ sung để lấp màn hình.

Tra cứu mẫu thiết kế sau hai truy vấn chưa trả về bố cục vận hành ERP phù hợp (kết quả thiên về landing page). Không lưu các đề xuất đó; bố cục dựa vào MASTER.md và component đang chạy. Hướng dẫn UX phù hợp cho bảng responsive, nhãn rõ, lỗi theo trường và điều hướng bàn phím.

## Kiểm chứng

Kiểm tra 390/768/1440px, các module ngành đại diện, form danh mục/chứng từ, bảng và tab, quyền xem/thao tác, focus và hành vi khi chưa lưu. Phát hành giao diện không đồng nghĩa hoàn tất ma trận 82 yêu cầu nghiệp vụ MISA.
