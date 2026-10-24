# Dashboard doanh nghiệp và đối chiếu mua hàng

## Nguồn số liệu

- `/erp/[slug]` dùng `business_company_dashboard`; mọi truy vấn suy ra `tenant_id` từ phiên đã xác thực và kiểm tra module được bật.
- KPI tổng hợp toàn bộ chứng từ đủ điều kiện, độc lập với danh sách chi tiết giới hạn 6 dòng. Không cộng dữ liệu từ bảng phân trang hoặc 100 bản ghi gần nhất.
- Tháng theo dõi chỉ áp dụng cho doanh thu và phát sinh tiền. Công nợ, tiền tồn, cảnh báo, tồn lô và vận hành là trạng thái hiện tại; ngày cập nhật được ghi trên dashboard. Múi giờ nghiệp vụ: Asia/Ho_Chi_Minh.
- Doanh thu thuần trước thuế lấy phát sinh Có trừ Nợ trên tài khoản 511 và 521 của sổ cái đã ghi sổ. Chưa có tự động kết chuyển kết quả kinh doanh; các bút toán kết chuyển thủ công cần đối chiếu riêng.
- Tiền tồn là Nợ trừ Có trên 111/112 đến ngày hiện tại, gồm số dư đầu kỳ. Thu/chi trong kỳ lấy biến động tiền ròng của từng chứng từ, bỏ chứng từ đầu kỳ; chuyển tiền nội bộ có tổng biến động bằng 0. Chứng từ đảo vẫn tham gia đúng ngày hạch toán, không xóa số gốc.
- Phải thu/phải trả là số dư hiện tại của chứng từ nguồn còn hiệu lực, gồm thuế. Quá hạn khi hạn thanh toán nhỏ hơn ngày hiện tại. Không thể suy ngược công nợ lịch sử từ `paid_amount` hiện tại.
- Biểu đồ nhóm 7 ngày từ đầu tháng, có bảng số liệu gốc; không dựng tỷ lệ tăng trưởng khi thiếu kỳ so sánh.

## Phân biệt ngành

| Ngành | Dữ liệu vận hành |
| --- | --- |
| Cơ khí | Sản lượng đạt ở công đoạn cuối / kế hoạch, chi phí vật tư và nhân công/máy đã ghi nhận, giờ công |
| Nhựa & bao bì | Lệnh theo khuôn đã chụp tại lúc phát hành, lượng phế, tiến độ sản lượng |
| Điện tử | Lắp ráp, sản lượng cuối, số liên kết lô nguồn được ghi nhận từ nhập thành phẩm |
| Thực phẩm | Mẻ sản xuất, hạn dùng lô thành phẩm gần nhất, cảnh báo lô đang có tồn |
| Thương mại | Giá trị hàng đã giao ròng sau trả hàng, quy đổi theo giá đặt hàng; không gọi đây là doanh thu kế toán |
| Xây dựng | Chi phí vật tư xuất công trình + chi phí khác / ngân sách; tách tiến độ báo cáo khỏi tỷ lệ sử dụng ngân sách |

Các số lượng khác đơn vị không được cộng chung thành sản lượng doanh nghiệp. Chi phí sản xuất/công trình là chi phí vận hành được ghi nhận, chưa tự động là giá vốn hay tiền đã chi. “Lô có tồn” đếm lô có số lượng dương; không tính lô rỗng. Chặn chất lượng và sắp hết hạn là hai thuộc tính có thể trùng nhau, không cộng thành tổng số lô bị chặn.

## Đối chiếu mua hàng

`/erp/[slug]/module/purchasing` dùng `business_procurement_matching`:

1. Đặt mua: số lượng × đơn giá trước thuế của dòng đơn đã phát hành.
2. Nhận theo giá đặt: lượng thực nhận × đơn giá bình quân của cùng mặt hàng trên đơn mua. Không cộng các đơn vị vật tư khác nhau.
3. Nhận thực tế: lượng nhận × đơn giá nhận đã ghi nhận, độc lập với hóa đơn.
4. Hóa đơn: tổng tiền trước thuế của hóa đơn đã ghi sổ liên kết đơn mua.
5. Phải trả: số dư gồm thuế của hóa đơn đó, sau các thanh toán đã ghi sổ.

Trạng thái ưu tiên: hóa đơn vượt đơn mua → hóa đơn trước nhận hàng → lệch đơn giá nhận → chờ nhận đủ → chờ hóa đơn → đã đối chiếu. Tổng KPI áp dụng toàn bộ kết quả tìm kiếm; bảng phân trang 25 dòng. Tắt kế toán thì không cung cấp dữ liệu hóa đơn/phải trả và không dựng liên kết sang module đã tắt.

Trigger `business_guard_purchase_invoice_value` chặn chuyển hóa đơn mua liên kết sang `posted` nếu tổng trước thuế vượt phần chưa lập hóa đơn của đơn mua. Khóa đơn mua giữ việc ghi sổ đồng thời tuần tự; các command hiện có vẫn giữ kiểm tra người duyệt, kỳ mở, phiên, phiên bản và receipt. Lỗi làm rollback cả bút toán và công nợ tạo trong cùng giao dịch. Dữ liệu đã ghi sổ trước migration được giữ nguyên, chênh lệch cũ vẫn xuất hiện khi đối chiếu.

Hóa đơn trước nhận hàng được hiển thị để xử lý, không bị cấm. Hóa đơn không liên kết đơn mua vẫn sử dụng được cho chi phí/dịch vụ riêng; cần đối chiếu ở phần kế toán. Đây là đối chiếu tổng giá trị, chưa phải phân bổ từng dòng hóa đơn hoặc quy trình dung sai giá được phê duyệt riêng.

## Giao diện giới thiệu

`CompanyDashboard` được dùng chung trong ERP và `IndustryScreenPreview`. Bản giới thiệu nhận `businessDashboardPreviews.json`, xuất từ cơ sở dữ liệu PostgreSQL tạm có dữ liệu trải nghiệm đã được phép công khai; không gọi API doanh nghiệp, không dùng session/token hay đọc dữ liệu thật của khách hàng. Chế độ 3D thu gọn số dòng; bản mở rộng dùng đầy đủ layout chung. Snapshot công khai không phải dashboard thời gian thực.

So sánh hiệu quả là mô phỏng có khối lượng công việc và phép tính từng bước; không phải số liệu đo từ sáu doanh nghiệp hoặc cam kết tiết kiệm. Bốn minh họa dùng định mức dạng cây, tồn kho dạng khối, tiến độ dự án và đơn bán/thanh toán riêng biệt. Giữ hero 3D hiện có.

## Phạm vi còn lại

Chưa bổ sung tài sản cố định, phân bổ trả trước, khai thuế, hóa đơn điện tử, tự động giá thành/giá vốn, tỷ lệ bảo hiểm/thuế theo luật hoặc phân quyền chi tiết theo phòng ban/công trình. Không coi dashboard và đối chiếu mua hàng là hoàn thành toàn bộ các nhóm nghiệp vụ trong hai tài liệu MISA.

## Kiểm tra thực hiện

Biên dịch schema và đọc read model với sáu bộ dữ liệu trải nghiệm trong PostgreSQL tạm; TypeScript, ESLint và build tối ưu. Không thêm hoặc chạy bộ test tự động trong đợt này theo chỉ dẫn phiên làm việc.

Đã áp dụng migration `202610240002`–`202610240004` vào Supabase phát triển `tcjjhxqtreemccdbvyza`. RPC chỉ được cấp execute cho service role; phiên doanh nghiệp được kiểm tra bên trong. Quan sát Edge trên bản tối ưu: 6 dashboard, 6 màn mua hàng, các kích thước 390/768/1440px; không có lỗi JavaScript/API trong lượt quan sát. Trên màn 1440×900, bộ chọn ngành nằm ở khoảng y=88–148 và đáy khung mẫu ở y=657–691. Không ghi nhận tồn âm hoặc chứng từ ghi sổ lệch Nợ/Có trong truy vấn tổng hợp sau triển khai; dữ liệu nội bộ cũ giữ nguyên số lượng.

Bằng chứng: [dimixo-company-dashboard-handoff.json](../commercial-erp/evidence/dimixo-company-dashboard-handoff.json). Đây là kết quả biên dịch, truy vấn tổng hợp và quan sát giao diện, không thay cho kiểm thử đầy đủ mọi tình huống ghi sổ, đồng thời hoặc đảo chứng từ.
