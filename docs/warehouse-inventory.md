# Kho và tồn kho

## Phạm vi

Module quản lý danh mục hàng hóa, đơn vị tính, nhóm hàng, nhiều kho, nhập, xuất, chuyển, điều chỉnh, kiểm kê, tồn hiện tại và sổ kho. Module không thực hiện định giá kế toán, phân bổ chi phí, quản lý lô/serial đầy đủ hoặc chỉnh trực tiếp số lượng tồn.

## Mô hình dữ liệu

- `inventory_items`, `item_categories`, `units_of_measure`: Item Master dùng chung. Mỗi hàng hóa có một đơn vị cơ sở; phiên bản này chỉ ghi sổ bằng đơn vị cơ sở để không phát sinh sai lệch chuyển đổi.
- `warehouses`, `warehouse_user_scopes`, `item_warehouse_settings`: kho, phạm vi người dùng và ngưỡng tồn.
- `inventory_documents`, `inventory_document_lines`: đầu phiếu và dòng hàng cho nhập, xuất, chuyển, điều chỉnh và đảo chứng từ.
- `stock_ledger`: nguồn sự thật bất biến. Trigger chặn `UPDATE` và `DELETE`.
- `inventory_balances`: số dư materialized, cập nhật trong cùng transaction với ledger.
- `stock_counts`, `stock_count_lines`: snapshot, thực kiểm, chênh lệch và liên kết phiếu điều chỉnh.
- `inventory_document_attachments`, `file_assets`: metadata tệp; object nằm trong bucket private `warehouse-documents`.

## Vòng đời chứng từ

`DRAFT → SUBMITTED → POSTED → REVERSED`; `DRAFT/SUBMITTED → CANCELLED` là điểm mở rộng. UI hiện hỗ trợ lưu nháp, ghi sổ và đảo phiếu nhập/xuất. Chứng từ đã ghi sổ không được sửa header hoặc dòng hàng; mọi sửa tồn phải tạo chứng từ mới hoặc chứng từ đảo.

## Ghi sổ và đồng thời

`post_inventory_document` là transaction boundary:

1. Khóa dòng chứng từ và advisory lock cho các kho liên quan theo thứ tự ổn định.
2. Trả về ngay nếu chứng từ đã ghi sổ; `post_idempotency_key` chống yêu cầu lặp.
3. Kiểm trạng thái, loại giao dịch, kho hoạt động, hàng hoạt động/có theo dõi tồn, UOM cơ sở và dòng điều chỉnh.
4. Với mỗi delta, `apply_inventory_delta` tạo số dư 0 nếu chưa có rồi `SELECT ... FOR UPDATE`.
5. Kiểm âm kho trên số dư đã khóa, ghi ledger và cập nhật balance trong cùng transaction.
6. Chuyển kho ghi cặp source/target nguyên tử; một phía lỗi thì toàn bộ transaction rollback.

Không có API cập nhật trực tiếp `inventory_balances`. Quyền override âm kho chỉ dành cho người có quyền ghi sổ điều chỉnh và bắt buộc lý do.

`reverse_inventory_document` tạo chứng từ `reversal`, sao chép dòng và ghi delta đối dấu. Phiếu gốc chuyển sang `REVERSED`; ledger cũ không thay đổi.

## Kiểm kê

- `freeze`: phiếu nhập/xuất/chuyển/điều chỉnh thông thường bị chặn trong thời gian kiểm.
- `reconcile`: khi ghi sổ, tồn kỳ vọng được cộng các ledger phát sinh sau `snapshot_at` trước khi tính chênh lệch.
- `save_stock_count` khóa phiên kiểm, kiểm `row_version` và cập nhật toàn bộ số kiểm nguyên tử.
- `post_stock_count` khóa kho, tạo phiếu `COUNT_VARIANCE` và ghi sổ trong cùng transaction. Không có chênh lệch thì phiên kiểm vẫn được ghi nhận `POSTED` mà không tạo phiếu rỗng.

## Phân quyền

Quyền tách theo khả năng xem/tạo/ghi sổ/đảo cho receipt, issue, transfer, adjustment và stock count. `warehouse.view_all` bỏ giới hạn phạm vi; nếu không có quyền này, `warehouse_user_scopes` quyết định kho được xem và thao tác. API luôn kiểm permission và scope, không dựa vào việc ẩn nút ở UI.

Tệp private chỉ cấp signed URL 5 phút sau khi kiểm quyền `file.read` và phạm vi source/target warehouse của chứng từ.

## API và giao diện

- Master: `/api/v1/items`, `/api/v1/item-categories`, `/api/v1/uom`, `/api/v1/warehouses`.
- Chứng từ: `/api/v1/warehouse/{receipts|issues|transfers|adjustments}` và action `/post`, `/reverse`.
- Kiểm kê: `/api/v1/warehouse/stock-counts`, `/:id`, `/:id/post`.
- Truy vấn: `/api/v1/warehouse/inventory`, `/ledger`, `/dashboard`, `/transaction-types`.
- Tệp: `/api/v1/warehouse/documents/:id/attachments`; tải xuống qua `/api/v1/files/:assetId/signed-url`.
- UI: `/warehouse`, `/warehouse/items`, `/warehouse/warehouses`, bốn nhóm chứng từ, `/warehouse/inventory`, `/warehouse/ledger`, `/warehouse/stock-counts`, `/settings/warehouse`.

## Tích hợp XNK và báo cáo

`createWarehouseReceiptFromShipment` tạo phiếu nhập nháp có `shipment_id`, tham chiếu lần nhận và external line reference. `getReceivedQuantityByShipmentReference` tổng hợp lượng đã nhận từ các phiếu `POSTED`, hỗ trợ nhận từng phần mà không cho XNK tự sửa tồn kho.

Field registry đã đăng ký các sheet `inventory_balance`, `stock_ledger`, `warehouse_receipts`, `warehouse_issues`, `stock_count`. Quyền xuất là `warehouse.report.export`; dữ liệu xuất phải tiếp tục áp dụng warehouse scope ở repository.

## Kiểm thử và triển khai

Unit test kiểm dấu nhập/xuất/chuyển/điều chỉnh, quy tắc bất biến, chống âm kho, kho nguồn/đích và đối chiếu balance-ledger. Trước triển khai chạy `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, sau đó áp migration trên môi trường staging và chạy hai transaction xuất đồng thời vào cùng `(warehouse_id,item_id)` để xác nhận một transaction rollback khi tổng xuất vượt tồn.

Máy phát triển cần Docker Desktop hoặc Podman để chạy Supabase local. Nếu không có, migration phải được kiểm tra trên staging trước khi phát hành production.
