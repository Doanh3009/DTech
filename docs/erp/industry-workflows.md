# Quy trình ERP cho sáu ngành

## Nguồn cấu hình và nơi sử dụng

- `businessIndustries.json`: gói ngành và module được phép bật.
- `businessEntities.json`: 25 loại danh mục/chứng từ, trường nhập và quan hệ.
- `businessWorkflows.json`: trình tự nghiệp vụ, tên ngành và dữ liệu minh họa giao diện.
- ERP `/erp/[slug]/module/[feature]`: dữ liệu vận hành thật qua RPC `business_operations_view`. Chọn mã để mở danh sách chứng từ tương ứng.
- Web setup `/control-center/industries`: xem sáu gói và tạo hồ sơ đã chọn ngành. Hồ sơ khách → Cấu hình ERP: cấp tài khoản hoặc lưu đồng bộ ngành/module/tên hệ thống.
- Trang giới thiệu dùng cùng workflow và mẫu giao diện. Các con số trong preview là fixture công khai, không được nạp vào tenant hoặc dùng làm báo cáo thật.

## Quy trình theo ngành

| Ngành | Chuẩn bị | Thực hiện | Đối chiếu |
| --- | --- | --- | --- |
| Cơ khí & gia công | Vật tư, kho, BOM, trạm và đơn giá giờ | Lệnh → công đoạn có thứ tự → phát hành → cấp nguyên liệu → báo sản lượng → nhập thành phẩm → QC lô → hoàn thành | Đạt công đoạn cuối, vật tư định mức/thực cấp, chi phí nhân công/máy |
| Nhựa & bao bì | BOM hạt nhựa, hao hụt cho phép, khuôn/số lòng/chu kỳ, trạm | Gắn khuôn vào lệnh → phát hành → cấp nguyên liệu → báo đạt/phế phẩm và giờ máy → nhập kho → QC | Khuôn đã chốt, lượng cấp, phế phẩm, tỷ lệ phế/đầu ra, chi phí/SP đạt |
| Điện tử & linh kiện | Linh kiện theo lô/sê-ri, QC đầu vào, BOM và công đoạn | Lệnh lắp ráp → cấp lô linh kiện → báo từng công đoạn/kiểm thử → nhận lô thành phẩm → QC | Liên kết lô tự tạo theo lệnh khi nhập; truy xuất nguồn nguyên liệu và các thành phẩm đã sử dụng, nhiều cấp |
| Thực phẩm & đồ uống | Nguyên liệu và thành phẩm theo lô, ngày sản xuất/hạn dùng, công thức, QC | Lô đầu vào đạt → phát hành lệnh → cấp nguyên liệu → báo sản lượng → nhập lô thành phẩm → QC đầu ra → xuất lô đạt | Tồn theo hạn dùng, lô chờ kiểm tra/không đạt/hết hạn, nguồn lô nguyên liệu |
| Thương mại & phân phối | Khách hàng, hàng hóa, kho và số dư đầu vào | Đơn bán + chi tiết → phát hành → giao từng phần → hoàn thành → thu tiền; trả hàng qua nhập kho gắn đơn | Đặt/đã giao/còn giao, khoản phải thu/đã thu/còn lại, hạn thanh toán |
| Xây dựng & thi công | Công trình, ngân sách, ngày bắt đầu, vật tư và kho | Phiếu vật tư công trình → ghi nhận; chi phí nhân công/thầu phụ/chi phí khác → ghi nhận; cập nhật tiến độ | Chi phí phiếu kho + chi phí nhập trực tiếp, ngân sách còn lại, tiến độ gần nhất, khoản mục |

## Quy tắc sản xuất

1. Phát hành cần BOM còn sử dụng và có nguyên liệu. Có MES thì cần công đoạn; nhựa/bao bì cần khuôn. BOM, hao hụt, thông số khuôn và đơn giá giờ trạm được chốt tại thời điểm phát hành. Không sửa công đoạn của lệnh đã phát hành.
2. Cấp nguyên liệu phải thuộc BOM chốt và không vượt tổng lượng kế hoạch gồm hao hụt được cho phép. Lô phải khả dụng, đủ tồn và đạt QC khi module chất lượng bật. Điện tử/thực phẩm yêu cầu lô cho truy xuất.
3. Sản lượng đạt được cộng trong từng công đoạn. Công đoạn sau chỉ sử dụng lượng đạt của công đoạn trước tính đến ngày báo cáo. Sản lượng hoàn thành lệnh chỉ lấy công đoạn cuối, không cộng tất cả công đoạn. Công đoạn trước được báo thêm lượng bù phế ở bước sau; lượng đạt cuối không vượt kế hoạch. Không có công đoạn thì lấy báo cáo không gắn công đoạn.
4. Nhập thành phẩm cần báo đủ sản lượng tương ứng và cấp đủ lượng nguyên liệu gốc cho toàn lệnh. Có thể nhập nhiều lần, tổng không vượt sản lượng cuối hoặc kế hoạch. Phiếu nhập tạo đúng một phát sinh sổ kho trong cùng transaction. Từ lần nhập đầu tiên, lượng nguyên liệu của lệnh được khóa; vẫn được báo bổ sung sản lượng đến kế hoạch.
5. Đơn giá nhập là đơn giá được duyệt do người dùng nhập. `Chi phí / SP đạt` là chi phí nguyên liệu + nhân công + máy chia lượng đạt cuối hiện tại, không phải giá vốn kế toán tự động. Phế/đầu ra = phế phẩm tất cả công đoạn / (đạt cuối + phế phẩm), không phải OEE.
6. Truy xuất tự động liên kết tất cả lô nguyên liệu đã cấp với mỗi lô đầu ra của lệnh. Lượng liên kết được phân bổ theo tỷ lệ lượng nhập / kế hoạch lệnh, làm tròn bốn số lẻ và đối chiếu phần đã phân bổ còn hiệu lực để không phân bổ vượt lượng cấp. Liên kết tự tạo có thể có lượng 0 do làm tròn; nguồn lô vẫn được giữ để truy xuất. Đây là phân bổ theo lệnh; không suy ra vị trí linh kiện trên từng bo mạch. Không được sửa/đảo liên kết tự tạo riêng khỏi phiếu nhập.
7. Hoàn thành lệnh cần đủ sản lượng cuối, đủ lượng nhập và các lô đầu ra được QC cho phép. Đảo nhập trước khi đảo nguyên liệu/báo cáo; chặn đảo báo cáo khi công đoạn sau đã ghi nhận. Lệnh hoàn thành khóa các điều chỉnh này.

## Công trình và công nợ

- Phiếu vật tư công trình vừa trừ tồn vừa được tập hợp vào chi phí công trình trong cùng giao dịch. Không nhập lại chi phí của phiếu này ở `Chi phí công trình`. Bảng khoản mục thể hiện các chi phí nhập trực tiếp; chi phí phiếu kho có cột riêng.
- Vượt ngân sách được thể hiện bằng ngân sách còn lại âm, không tự chặn ghi nhận chi phí thực tế.
- Phải thu theo đơn được lập khi phát hành đơn bán, theo giá trị đơn. Đây không phải hóa đơn thuế. Trả hàng mở lại đơn theo lượng giao ròng; không tự giảm công nợ vì chưa có luồng chấp thuận giảm giá/credit note.
- Chứng từ đã ghi nhận giữ bản gốc. Đảo phiếu kho/phiếu nguồn tạo bút toán kho bù; đảo thu tiền giảm số đã thu. QC đã có lô xuất hoặc lệnh đã hoàn thành bị khóa theo quan hệ phụ thuộc. Mọi command có UUID, CAS, receipt, audit và tenant từ phiên.

## Đồng bộ setup

`PUT /api/v1/crm/customers/[id]/workspace/configuration` yêu cầu cả phiên bản hồ sơ CRM và tenant. RPC kiểm tra quyền CRM, module thuộc gói và các phụ thuộc; cập nhật tenant + hồ sơ nguyên tử. Ngành có dữ liệu không được đổi; module có dữ liệu không được tắt. Chỉ đổi tên hệ thống hoặc bật thêm module phù hợp vẫn được phép. Không di chuyển hay xóa dữ liệu khi đổi cấu hình.

CRM không ghi đè ngành ERP đã cấp qua biểu mẫu hồ sơ. Tên doanh nghiệp trong hồ sơ được đồng bộ vào tenant; tên hệ thống lấy từ cấu hình ERP. Tài khoản và dữ liệu vẫn tách theo tenant, không mở truy vấn ERP nội bộ cũ cho khách. Setup nội bộ `/system-admin/setup` giữ miền cấu hình cũ.

## Migration và phạm vi hoàn thiện

- `202610230012`: hai chứng từ nhập thành phẩm/vật tư công trình, snapshot, quy tắc sản xuất và đảo chứng từ.
- `202610230013`: read model vận hành và truy xuất nhiều cấp; overview tính đúng sản lượng cuối và chi phí vật tư công trình.
- `202610230014`: command đồng bộ setup, bảo vệ cấu hình CRM và thứ tự khóa CRM → tenant cho operator.
- Không sửa migration lịch sử. Script generator xuất DDL tham khảo vào `.tmp/`, không ghi đè migration đã có.

Đã biên dịch schema trên PostgreSQL tạm không dữ liệu khách hàng; registry/DDL khớp 25 loại chứng từ. Lượt thay đổi này không chạy bộ test; bằng chứng cũ 46 native checks và 1.936 unit checks thuộc phiên bản giao hàng trước, không chứng nhận các migration mới. Chưa áp dụng migration mới lên Supabase cloud.

Phạm vi này là các luồng vận hành được liệt kê ở trên. Mua hàng, MRP, hoạch định năng lực, kết nối máy MES, FEFO tự xuất, giá thành chuẩn kế toán, hóa đơn điện tử, sổ cái và lương chưa nằm trong các command mới. Không công bố các tính năng đó là đã hoàn thiện.
