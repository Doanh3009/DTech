# Xuất nhập khẩu

Module quản lý chuỗi `Đối tác → Hợp đồng/PO → Shipment → Dòng hàng/Container/Chứng từ → Thông quan → Phiếu nhập kho`.

## Mô hình dữ liệu

- `business_partners` dùng chung cho supplier, forwarder, carrier, customs broker, customer và other.
- `import_contracts`, `import_contract_lines` quản lý PO/hợp đồng nhiều dòng. Một hợp đồng có nhiều shipment.
- `shipments` có mã nội bộ ổn định, tách ETD/ETA dự kiến khỏi ngày khởi hành/cập cảng thực tế, có `row_version` và phạm vi người phụ trách.
- `shipment_lines` tham chiếu trực tiếp `inventory_items`; snapshot mã, tên và quy cách chỉ dùng để giữ lịch sử.
- `shipment_containers` hỗ trợ 0..n container. Bảng allocation đã sẵn sàng cho phân bổ dòng hàng theo container.
- `shipment_documents` là bản ghi có loại và phiên bản. Bản thay thế tham chiếu bản trước, không xóa lịch sử.
- `shipment_schedule_history`, `shipment_status_history`, `shipment_customs`, `shipment_delivery_info` lưu lịch sử và trạng thái có cấu trúc.
- `shipment_receiving_resolutions` ghi nhận việc chốt thiếu hoặc chấp nhận thừa kèm lý do.

Mã `PO-YYYY-NNNNNN` và `SHP-YYYY-NNNNNN` được cấp bằng sequence theo năm trong transaction. Tiền tố cấu hình tại `/settings/import-export`.

## Nhận hàng và kho

XNK không ghi `stock_ledger`. API tạo phiếu nhập gọi `createWarehouseReceiptFromShipment` của Warehouse domain, chỉ tạo receipt ở trạng thái draft để nhân sự kho kiểm tra và post.

Mỗi dòng receipt lưu `shipment_line_id`. Số đã nhận được tính trực tiếp từ dòng phiếu nhập có `inventory_documents.type = receipt` và `status = posted`:

- Nhận nhiều lần được cộng dồn theo dòng shipment.
- Phiếu draft không ảnh hưởng số đã nhận.
- Khi đảo phiếu, phiếu gốc chuyển sang `reversed`, vì vậy tổng posted tự giảm mà không cần cache trong shipment.
- Request tạo phiếu nhận dùng `client_request_id`; gửi lặp cùng key trả lại phiếu cũ. Một lần nhận chủ động tiếp theo dùng key mới.
- Nhận vượt số còn lại phải có lý do; vượt quá dung sai cấu hình bị từ chối.
- Thiếu hàng có thể được chốt bằng resolution có lý do và audit.

## Lịch trình và cảnh báo

RPC `update_shipment_schedule` khóa shipment, kiểm tra `row_version`, ghi history rồi mới cập nhật ngày hiện tại. `client_request_id` ngăn lịch sử trùng. Người cập nhật thứ hai với version cũ nhận HTTP 409.

Dashboard áp dụng rule thuần:

- ETA hiện tại trễ hơn ETA gốc theo ngưỡng.
- Thiếu chứng từ bắt buộc theo cấu hình loại chứng từ.
- Customs ở trạng thái `issue` hoặc kéo dài sau khi khai.
- Đã cập cảng nhưng chưa có receipt posted.
- Thiếu hàng chưa chốt.
- Shipment lâu không cập nhật.

Các ngưỡng được lưu trong `import_export_settings`.

## Quyền và phạm vi

Quyền tách theo hợp đồng, shipment, lịch trình, tài liệu, customs, receiving, partner và report. Người có `import_export.view_all` xem toàn bộ; người còn lại chỉ xem shipment được giao hoặc do mình tạo. Kiểm tra này chạy ở repository/API, kể cả URL trực tiếp và lúc cấp signed URL.

Tài liệu nằm trong bucket private `shipment-documents`, MIME whitelist, tối đa 15 MB. Viewer cần đồng thời `file.read`, `shipment_document.view` và quyền phạm vi shipment. Excel chỉ dùng deep link `/import-export/shipments/:id/documents`, không chứa signed URL hết hạn.

## Route UI

- `/import-export`
- `/import-export/contracts`, `/new`, `/:id`
- `/import-export/shipments`, `/new`
- `/import-export/shipments/:id/overview|lines|containers|documents|customs|receiving|history`
- `/import-export/partners`
- `/import-export/documents`
- `/settings/import-export`

## Report Engine

Registry dùng chung có các sheet `import_shipments`, `import_contract_fulfillment`, `shipment_document_checklist`, `shipment_receiving`, `customs_status`, đều yêu cầu `import_export.report.export`.

## Giới hạn hiện tại

- Chưa tích hợp API carrier/forwarder; interface `ShipmentTrackingProvider` là extension point.
- Không có kế toán, thanh toán, LC/banking hoặc bản đồ tàu trực tiếp.
- Không có hàng đợi sự kiện riêng; receiving được query trực tiếp từ Warehouse để ưu tiên tính đúng.
- Contract editor V1 giữ nguyên số dòng sau khi đã tạo để không làm mất tham chiếu shipment; có thể sửa nội dung từng dòng.
