# PROMPT 10 — QUẢN LÝ KHO: HÀNG HÓA, NHẬP/XUẤT/CHUYỂN KHO, KIỂM KÊ, STOCK LEDGER VÀ KIỂM SOÁT CHỨNG TỪ

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Các prompt trước đã xác lập:

- kiến trúc nền tảng
- routing thật
- enterprise design system
- frontend desktop/mobile
- module Nhân sự
- User Account tách Employee Record
- Role / Permission
- Admin Console / Branding
- chấm công cá nhân
- Project / Worksite
- điểm danh công nhân tập thể
- nghỉ phép / approval / phép năm / PDF
- ca làm / bảng công / khóa kỳ / Excel
- cập nhật dự án / issue / dashboard quản lý
- API-first
- configuration over hard-code
- audit foundation
- private file storage

Prompt này triển khai **module Quản lý Kho**.

Đây là module nghiệp vụ nặng và phải làm chặt ngay từ đầu.

Không được làm theo kiểu CRUD đơn giản:

```text
Product
Quantity
Edit quantity directly
```

Mà phải theo tư duy:

```text
Item Master
+
Warehouse
+
Inventory Document
+
Stock Ledger
+
Inventory Balance
+
Audit
```

Tồn kho phải được suy ra từ giao dịch hợp lệ, không chỉnh tay trực tiếp.

---

# 1. MỤC TIÊU

Xây module kho có khả năng:

1. Quản lý danh mục hàng hóa.
2. Quản lý nhiều kho.
3. Quản lý đơn vị tính.
4. Nhập kho.
5. Xuất kho.
6. Chuyển kho.
7. Điều chỉnh kho.
8. Kiểm kê.
9. Stock Ledger.
10. Tồn kho hiện tại.
11. Lịch sử giao dịch.
12. Khóa/chốt chứng từ.
13. Đảo giao dịch khi sai.
14. Phân quyền kho.
15. Gắn người thực hiện.
16. Gắn project/worksite nếu nghiệp vụ yêu cầu.
17. Đính kèm chứng từ.
18. Audit.
19. Báo cáo kho cơ bản.
20. Chuẩn bị tích hợp với Xuất nhập khẩu ở Prompt tiếp theo.

Không triển khai kế toán tài chính đầy đủ trong prompt này.

Không triển khai landed cost đầy đủ nếu chưa có Prompt XNK.

---

# 2. NGUYÊN TẮC CỐT LÕI

Tuyệt đối không dùng:

```text
items.current_quantity
```

như source of truth có thể edit trực tiếp.

Tồn kho phải đến từ:

```text
POSTED INVENTORY TRANSACTIONS
↓
STOCK LEDGER
↓
BALANCE
```

Có thể cache/materialize balance để tăng tốc, nhưng source of truth phải là ledger/giao dịch đã post.

---

# 3. PHÂN BIỆT MASTER DATA VÀ TRANSACTION DATA

## Master data

```text
Item
Item Category
Unit of Measure
Warehouse
Warehouse Location/Bin nếu sau này cần
Supplier reference nếu tích hợp
```

## Transaction data

```text
Goods Receipt
Goods Issue
Stock Transfer
Inventory Adjustment
Stock Count
```

Không trộn hai nhóm.

---

# 4. ITEM MASTER

Mỗi hàng hóa cần tối thiểu:

```text
Mã hàng *
Tên hàng *
Nhóm hàng
Đơn vị tính cơ bản *
Mô tả
Trạng thái
Theo dõi tồn kho?
Ghi chú
```

Có thể thêm:

```text
Tên ngắn
Quy cách
Thông số kỹ thuật
Manufacturer
Brand
Country of origin
```

nhưng chỉ nếu cần.

Không nhét mọi thuộc tính kỹ thuật vào schema cứng nếu danh mục hàng hóa rất đa dạng.

---

# 5. MÃ HÀNG

`item_code` phải:

- unique
- ổn định
- human-readable nếu công ty dùng
- không dùng DB UUID làm mã hiển thị

Phân biệt:

```text
id
item_code
```

Không dùng tên hàng làm identity.

---

# 6. NHÓM HÀNG

Tạo entity:

```text
Item Category
```

Có thể support hierarchy:

```text
Thép ray
├─ Ray cầu trục
├─ Ray đường sắt
└─ Phụ kiện ray
```

Không bắt buộc hierarchy sâu.

Admin có thể:

- thêm
- sửa
- vô hiệu hóa
- sắp xếp

Không hard delete category đang được dùng.

---

# 7. ĐƠN VỊ TÍNH

Tạo:

```text
Unit of Measure
```

Ví dụ:

```text
Cây
Thanh
Kg
Tấn
Mét
Bộ
Cái
Cuộn
Thùng
```

Không hard-code.

Nếu tương lai có conversion:

```text
1 cây = 12m
```

architecture phải support nhưng V1 không cần full UOM conversion engine nếu chưa có yêu cầu.

---

# 8. HÀNG KHÔNG THEO DÕI TỒN

Có thể có item/service:

```text
tracked_inventory = false
```

Không đưa vào stock balance.

Nhưng nếu module kho chỉ dùng vật tư thật, có thể để feature extension point.

---

# 9. WAREHOUSE MASTER

Mỗi kho:

```text
Mã kho *
Tên kho *
Địa chỉ
Người phụ trách
Trạng thái
Ghi chú
```

Có thể link:

```text
Worksite / Project
```

nếu là kho công trường.

Không hard-code một kho duy nhất.

---

# 10. WAREHOUSE TYPE

Có thể support:

```text
Kho chính
Kho công trường
Kho tạm
Kho ngoại quan nếu future cần
```

Không bắt buộc mọi loại ở V1.

---

# 11. BIN / LOCATION — FUTURE READY

Không cần full bin management ở V1 nếu công ty chưa dùng.

Nhưng schema không nên khóa việc sau này thêm:

```text
Warehouse
↓
Zone
↓
Bin
```

Có thể không render UI ở V1.

---

# 12. ROUTING

Bắt buộc routing thật.

Ví dụ:

```text
/warehouse
/warehouse/items
/warehouse/items/new
/warehouse/items/:id

/warehouse/warehouses
/warehouse/warehouses/:id

/warehouse/receipts
/warehouse/receipts/new
/warehouse/receipts/:id

/warehouse/issues
/warehouse/issues/new
/warehouse/issues/:id

/warehouse/transfers
/warehouse/transfers/new
/warehouse/transfers/:id

/warehouse/adjustments
/warehouse/adjustments/:id

/warehouse/stock-counts
/warehouse/stock-counts/:id

/warehouse/inventory
/warehouse/ledger

/settings/warehouse
```

Không giant page.

---

# 13. INVENTORY DOCUMENT LIFECYCLE

Mỗi chứng từ kho phải có trạng thái rõ:

```text
DRAFT
SUBMITTED
POSTED
CANCELLED
REVERSED
```

Không chỉ:

```text
saved = true
```

---

# 14. DRAFT

Draft:

- chưa tác động tồn kho
- có thể chỉnh
- có thể xóa nếu chưa có dependency

---

# 15. POSTED

Khi POST:

- validation đầy đủ
- tạo stock ledger entries
- cập nhật balance/materialized balance
- ghi posted_by
- posted_at
- không cho sửa dòng giao dịch trực tiếp

---

# 16. POSTED DOCUMENT KHÔNG ĐƯỢC EDIT ÂM THẦM

Nếu chứng từ đã POST:

Không cho:

```text
edit quantity 100 → 80
```

rồi update ledger silently.

Phải:

```text
Reverse / Adjustment
```

hoặc:

```text
Unpost
```

chỉ nếu policy cho phép và chưa có downstream dependency.

Ưu tiên reversal.

---

# 17. REVERSAL

Khi sai chứng từ:

```text
Original receipt +100
↓
Reverse -100
↓
Create corrected receipt +80
```

History rõ.

Không xóa original.

---

# 18. DOCUMENT NUMBER

Mỗi chứng từ có mã ổn định.

Ví dụ:

```text
PNK-2026-000123
PXK-2026-000087
CK-2026-000025
KK-2026-000012
```

Không dùng UUID làm mã hiển thị chính.

Numbering service phải idempotent/concurrency-safe.

---

# 19. GOODS RECEIPT — NHẬP KHO

Header:

```text
Số phiếu
Ngày chứng từ
Kho nhận *
Loại nhập
Nhà cung cấp nếu có
Project/Shipment reference nếu có
Người giao
Người nhận
Ghi chú
Tài liệu đính kèm
Trạng thái
```

Lines:

```text
Item *
Quantity *
UOM
Unit price optional
Reference
Note
```

V1 có thể chưa dùng giá nếu chưa tích hợp kế toán.

---

# 20. RECEIPT TYPE

Có thể cấu hình:

```text
Nhập mua hàng
Nhập từ XNK
Nhập trả lại
Nhập điều chỉnh
Nhập khác
```

Không dùng type text tùy ý.

---

# 21. GOODS ISSUE — XUẤT KHO

Header:

```text
Số phiếu
Ngày
Kho xuất *
Loại xuất
Project / Worksite nếu áp dụng
Người nhận
Bộ phận nhận
Ghi chú
Tài liệu
```

Lines:

```text
Item
Quantity
UOM
Purpose
```

---

# 22. ISSUE TYPE

Ví dụ:

```text
Xuất công trình
Xuất sử dụng nội bộ
Xuất trả nhà cung cấp
Xuất bán hàng nếu future
Xuất điều chỉnh
Xuất khác
```

Không hard-code vào UI logic.

---

# 23. KHÔNG CHO ÂM KHO MẶC ĐỊNH

Policy:

```text
allow_negative_inventory = false
```

Default nên false.

Nếu quantity issue > available:

```text
Tồn kho không đủ.
Khả dụng: 50
Yêu cầu xuất: 60
```

Không post.

Nếu công ty muốn override, phải:

- config explicit
- permission cao
- reason
- audit

---

# 24. RESERVED INVENTORY — FUTURE READY

V1 chưa cần reservation engine nếu chưa có nghiệp vụ.

Nhưng balance terminology có thể phân biệt tương lai:

```text
On Hand
Reserved
Available
```

Nếu chưa implement, chỉ dùng On Hand.

Không fake reserved = 0 nếu không có feature.

---

# 25. STOCK TRANSFER

Chuyển giữa kho:

```text
Kho A
↓
Kho B
```

Không tạo độc lập:

```text
Issue A
Receipt B
```

bằng tay nếu có thể.

Một Transfer document phải sinh paired ledger entries transactionally.

---

# 26. TRANSFER LIFECYCLE

V1 có thể:

```text
DRAFT
POSTED
```

hoặc nếu vận chuyển giữa kho dài:

```text
DRAFT
DISPATCHED
RECEIVED
```

Chọn theo business hiện tại.

Nếu chưa cần in-transit tracking, dùng simple posted transfer.

Architecture không khóa future in-transit.

---

# 27. STOCK ADJUSTMENT

Không cho user chỉnh balance trực tiếp.

Adjustment document:

```text
Warehouse
Date
Reason *
Lines:
Item
Adjustment quantity (+/-)
Note
```

Post → ledger.

Permission cao.

Audit bắt buộc.

---

# 28. STOCK COUNT / KIỂM KÊ

Workflow:

```text
Create Count
↓
Snapshot expected quantity
↓
Enter counted quantity
↓
Variance
↓
Review
↓
Post adjustment
```

Không cập nhật tồn ngay khi user nhập số kiểm kê.

---

# 29. STOCK COUNT HEADER

```text
Count number
Warehouse
Count date
Scope
Status
Created by
Reviewed by
Posted by
Note
```

---

# 30. STOCK COUNT LINES

```text
Item
Expected quantity snapshot
Counted quantity
Variance
Note
```

Expected phải snapshot tại thời điểm count creation/start theo policy.

Không thay đổi âm thầm nếu transaction phát sinh.

---

# 31. STOCK COUNT CONCURRENCY

Nếu kho vẫn giao dịch trong khi kiểm kê:

Cần policy:

```text
freeze transactions during count
```

hoặc:

```text
cutoff snapshot + reconcile movements
```

V1 ưu tiên đơn giản:

- có thể lock warehouse transactions trong count window nếu công ty cho phép
- hoặc warning và require refresh before posting

Không làm logic half-correct.

---

# 32. STOCK LEDGER

Đây là core.

Mỗi ledger entry:

```text
id
warehouse_id
item_id
transaction_type
transaction_id
transaction_line_id
posting_date
quantity_in
quantity_out
signed_quantity
uom
reference
created_at
```

Có thể thêm:

```text
project_id
worksite_id
shipment_id
```

nếu source có.

---

# 33. IMMUTABILITY LEDGER

Posted ledger entry không edit trực tiếp.

Sai thì reversal/new entry.

Không làm CRUD edit ledger.

---

# 34. BALANCE

Balance:

```text
warehouse
item
on_hand
```

Có thể derive SUM ledger.

Nếu performance cần:

```text
inventory_balances
```

materialized/cached.

Nhưng update phải transactionally consistent với ledger.

---

# 35. BALANCE RECONCILIATION

Có service/job kiểm tra:

```text
SUM(ledger) == balance
```

Nếu mismatch:

- log
- admin alert
- không tự silently fix

Có repair tool permission cao nếu cần.

---

# 36. INVENTORY VIEW

Route:

```text
/warehouse/inventory
```

Table:

```text
Mã hàng
Tên hàng
Nhóm
Kho
Đơn vị
Tồn hiện tại
Trạng thái
```

Filter:

```text
Kho
Nhóm hàng
Hàng hóa
Có tồn / Hết hàng
```

---

# 37. MULTI-WAREHOUSE VIEW

Cho xem:

```text
Item A
Kho chính: 100
Kho công trường A: 20
Kho công trường B: 15
Tổng: 135
```

Không lưu một global quantity duy nhất.

---

# 38. ITEM DETAIL

Route:

```text
/warehouse/items/:id
```

Tabs route-backed:

```text
Tổng quan
Tồn kho
Lịch sử giao dịch
Tài liệu
```

Có thể show:

```text
Tồn theo kho
Giao dịch gần đây
```

---

# 39. WAREHOUSE DETAIL

Route:

```text
/warehouse/warehouses/:id
```

Tabs:

```text
Tổng quan
Tồn kho
Nhập
Xuất
Chuyển
Kiểm kê
Lịch sử
```

Không giant page.

---

# 40. SEARCH / FILTER

Item search:

```text
Mã hàng
Tên hàng
Nhóm
```

Document search:

```text
Số phiếu
Item
Warehouse
Project
Supplier
Date range
Status
```

Không fetch toàn bộ dữ liệu.

---

# 41. DOCUMENT DETAIL UI

Header:

```text
Phiếu nhập PNK-2026-000123
Đã ghi sổ
09/09/2026
Kho chính
```

Sections:

```text
Thông tin chung
Danh sách hàng
Tài liệu
Lịch sử xử lý
```

Actions theo status:

```text
Draft:
Sửa
Gửi
Xóa

Submitted:
Post
Reject/Return to Draft nếu policy

Posted:
Reverse
Export/Print

Reversed:
View reversal
```

---

# 42. LINE EDITOR

Không làm spreadsheet quá phức tạp.

Desktop:

```text
Item search
Quantity
UOM
Note
```

Có:

```text
+ Thêm dòng
```

Keyboard-friendly.

Không cho duplicate item lines vô lý nếu business không cần.

Có thể merge hoặc warning.

---

# 43. MOBILE WAREHOUSE

Module kho ưu tiên desktop/tablet.

Mobile chỉ cần tốt cho:

- tra tồn
- xem phiếu
- xác nhận đơn giản
- scan barcode future

Không ép full complex receipt editor trên điện thoại nếu UX kém.

---

# 44. BARCODE — FUTURE READY

Không bắt buộc V1.

Architecture có thể chuẩn bị:

```text
item_barcode
```

và reusable scanner component sau.

Không implement nếu chưa yêu cầu.

---

# 45. LOT / BATCH / SERIAL — FUTURE READY

Không triển khai full lot/serial ở V1 nếu chưa dùng.

Nhưng tránh thiết kế schema khiến sau này không thể thêm.

Có thể tạo extension point ở transaction lines.

Không overengineer.

---

# 46. EXPIRY DATE — FUTURE READY

Chỉ cần nếu hàng có hạn dùng.

Không thêm bắt buộc cho thép/vật tư không cần.

---

# 47. PROJECT / WORKSITE LINK

Goods Issue có thể gắn:

```text
Project
Worksite
```

để biết vật tư xuất đi đâu.

Không bắt buộc mọi phiếu phải có project.

Admin config/type quyết định.

---

# 48. PROJECT CONSUMPTION HOOK

Sau này Project dashboard/report có thể query:

```text
Vật tư đã xuất cho project
```

Không tính chi phí project đầy đủ trong prompt này.

Chỉ giữ reference.

---

# 49. XNK INTEGRATION HOOK

Goods Receipt phải có thể reference:

```text
shipment_id
shipment_receipt_reference
```

Prompt XNK sau sẽ dùng.

Không duplicate item master giữa XNK và Warehouse.

---

# 50. PURCHASE ORDER HOOK

Nếu sau này có PO:

Receipt line có thể reference:

```text
purchase_order_line_id
```

V1 không build Purchasing nếu chưa có prompt.

---

# 51. PARTIAL RECEIPT

Rất quan trọng cho XNK.

Một shipment/order có thể:

```text
Expected 100
Received 60
Later received 40
```

Warehouse receipt phải support partial quantities.

Không assume một reference chỉ có một receipt.

---

# 52. OVER / SHORT RECEIPT

Receipt có thể ghi:

```text
Expected
Received
Variance
```

nếu reference có expected qty.

Không block over/short theo hard-code.

Policy/warning:

```text
Thiếu 5
Dư 2
```

Prompt XNK sẽ xử lý sâu hơn.

---

# 53. DOCUMENT ATTACHMENTS

Cho phép:

```text
Phiếu giao hàng
Biên bản
Ảnh
PDF
Excel
```

Private storage.

Stable internal route.

Permission check.

---

# 54. PRINT / PDF HOOK

Có thể cần in phiếu nhập/xuất.

Prompt này có thể chuẩn bị:

```text
Print-friendly detail
```

hoặc PDF hook.

Không cần xây template engine phức tạp nếu chưa yêu cầu.

Nếu tạo PDF, branding lấy Admin Console.

---

# 55. APPROVAL — FOUNDATION

Một số doanh nghiệp cần duyệt:

```text
Draft → Approved → Posted
```

Có thể reuse Approval primitives.

Nếu hiện tại chưa cần, config:

```text
warehouse.document_requires_approval = false
```

Architecture phải support.

---

# 56. PERMISSIONS

Gợi ý:

```text
warehouse.view
warehouse.view_all

warehouse.item.view
warehouse.item.manage

warehouse.master.manage

warehouse.receipt.view
warehouse.receipt.create
warehouse.receipt.post
warehouse.receipt.reverse

warehouse.issue.view
warehouse.issue.create
warehouse.issue.post
warehouse.issue.reverse

warehouse.transfer.view
warehouse.transfer.create
warehouse.transfer.post

warehouse.adjustment.view
warehouse.adjustment.create
warehouse.adjustment.post

warehouse.stock_count.view
warehouse.stock_count.create
warehouse.stock_count.post

warehouse.ledger.view
warehouse.report.export
```

Không hard-code role.

---

# 57. WAREHOUSE SCOPE

Một user có thể chỉ được quản lý:

```text
Kho chính
```

không phải tất cả kho.

Authorization phải support:

```text
permission
+
warehouse scope
```

Không vì có `warehouse.view` mà mặc định xem tất cả nếu system cần scope.

Admin/all-scope permission tách riêng nếu cần.

---

# 58. DOCUMENT POST PERMISSION

Tạo phiếu và Post phiếu có thể là hai permission khác.

Ví dụ:

```text
warehouse.receipt.create
warehouse.receipt.post
```

Người nhập dữ liệu không nhất thiết được ghi sổ.

---

# 59. AUDIT

Audit bắt buộc:

```text
item created/edited
warehouse created/edited
document created
document edited in draft
submitted
posted
reversed
stock count posted
adjustment posted
permission-sensitive export
```

Không audit mỗi keystroke.

---

# 60. REASON FOR REVERSAL

Reverse document:

```text
Reason *
```

Lưu:

```text
reversal_document_id
reversed_by
reversed_at
```

---

# 61. CONCURRENCY

Posting phải concurrency-safe.

Ví dụ hai issue cùng xuất item A:

```text
On hand 10
Issue A = 8
Issue B = 5
```

Không được cả hai cùng post dẫn tới -3 nếu negative stock disabled.

Dùng DB transaction/locking phù hợp.

---

# 62. IDEMPOTENCY

Post endpoint phải idempotent.

Double-click:

```text
POST
POST
```

không tạo ledger gấp đôi.

---

# 63. TRANSACTION BOUNDARY

Khi post:

```text
validate
↓
create ledger
↓
update balance
↓
update document status
```

phải atomic.

Nếu fail giữa chừng:

rollback.

---

# 64. DOCUMENT VERSION

Draft có thể dùng optimistic locking.

Nếu hai user edit:

```text
Dữ liệu vừa được cập nhật bởi người khác.
```

Không overwrite silent.

---

# 65. DATE / POSTING DATE

Phân biệt:

```text
document_date
posting_date
created_at
posted_at
```

Không chỉ có một timestamp.

Backdated posting cần permission/policy nếu cho phép.

---

# 66. CLOSED PERIOD — FUTURE READY

Nếu sau này có inventory period close:

- không post backdate vào period closed

V1 có thể chưa implement full period close.

Nhưng schema/API nên không khóa.

---

# 67. STOCK VALUATION — KHÔNG LÀM SÂU Ở V1

Không tự implement:

```text
FIFO
Weighted Average
Standard Cost
```

nếu công ty chưa yêu cầu.

Có thể lưu optional unit cost trên receipt line.

Không dùng nó làm accounting truth.

Prompt kế toán riêng nếu cần.

---

# 68. INVENTORY ALERT

Có thể config:

```text
minimum_stock
reorder_level
```

per item/warehouse.

Dashboard:

```text
Hàng sắp hết
Hết hàng
```

Không cần procurement automation.

---

# 69. INVENTORY DASHBOARD

Route:

```text
/warehouse
```

Hiển thị:

```text
Tổng mặt hàng
Hết hàng
Sắp hết
Phiếu chờ xử lý
Giao dịch gần đây
```

Không 15 chart.

---

# 70. LOW STOCK

Nếu `minimum_stock` configured:

```text
on_hand <= minimum_stock
```

show warning.

Không dùng red nếu chỉ low stock medium severity.

---

# 71. STOCK LEDGER VIEW

Route:

```text
/warehouse/ledger
```

Table:

```text
Ngày
Kho
Mã hàng
Tên hàng
Loại giao dịch
Số chứng từ
Nhập
Xuất
Số dư sau giao dịch nếu có
Project/Reference
Người post
```

Có filter.

---

# 72. RUNNING BALANCE

Nếu hiển thị running balance:

Phải tính deterministic theo:

```text
posting_date
posted_at
ledger sequence
```

Không chỉ sort timestamp mơ hồ.

---

# 73. EXPORT

Reuse Report Engine Prompt 08.

Report types future/current:

```text
INVENTORY_BALANCE
STOCK_LEDGER
WAREHOUSE_RECEIPTS
WAREHOUSE_ISSUES
STOCK_COUNT
```

Không build engine mới.

---

# 74. EXCEL WAREHOUSE

Template mặc định có thể:

```text
Ton_kho
Nhap_kho
Xuat_kho
Lich_su_giao_dich
```

Không cần implement tất cả nếu Report Engine integration ở bước này quá lớn, nhưng field registry phải có.

---

# 75. RAW TECHNICAL DATA

Không export mặc định:

```text
UUID
internal storage path
DB sequence
```

Báo cáo human-readable.

---

# 76. ITEM IMPORT — OPTIONAL

Nếu cần bulk item import:

Reuse generic import foundation hoặc tạo controlled Excel import.

Không triển khai nếu chưa có yêu cầu.

Nếu implement:

- template
- validation preview
- duplicate handling
- dry run
- audit

Không import thẳng DB.

---

# 77. DOCUMENT IMPORT — KHÔNG

Không cho import posted ledger bằng Excel trực tiếp ở V1.

Nếu migration dữ liệu cũ, dùng migration/import tool riêng có kiểm soát.

---

# 78. SECURITY

Bắt buộc:

- server-side permission
- warehouse scope
- private attachments
- no service role client-side
- input validation
- no arbitrary item id manipulation
- no negative stock race
- no ledger edit API
- no posted document edit API

---

# 79. DATABASE MODEL GỢI Ý

Không bắt buộc tên chính xác.

```text
items
item_categories
units_of_measure

warehouses
warehouse_user_scopes optional

inventory_documents
inventory_document_lines

stock_ledger
inventory_balances

stock_counts
stock_count_lines

inventory_adjustments hoặc dùng document type

item_warehouse_settings
```

Có thể dùng unified document table hoặc separate receipt/issue/transfer tables.

Ưu tiên clear domain + maintainability.

---

# 80. UNIFIED VS SEPARATE DOCUMENT MODEL

Có thể chọn:

```text
inventory_documents
type = RECEIPT / ISSUE / TRANSFER / ADJUSTMENT
```

nếu schema rõ.

Hoặc separate tables.

Không tạo một giant JSON document table thiếu constraints.

---

# 81. LINE SIGN

Không để UI quyết định signed quantity.

Backend mapping:

```text
RECEIPT → +
ISSUE → -
TRANSFER → source -, destination +
ADJUSTMENT → +/-
```

---

# 82. FOREIGN KEY INTEGRITY

Không delete:

- item đã có ledger
- warehouse đã có ledger

Dùng:

```text
inactive
```

---

# 83. API GỢI Ý

Master:

```text
GET/POST/PATCH /api/v1/items
GET/POST/PATCH /api/v1/warehouses
GET/POST/PATCH /api/v1/item-categories
GET/POST/PATCH /api/v1/uom
```

Inventory:

```text
GET/POST /api/v1/warehouse/receipts
GET/PATCH /api/v1/warehouse/receipts/:id
POST /api/v1/warehouse/receipts/:id/post
POST /api/v1/warehouse/receipts/:id/reverse

GET/POST /api/v1/warehouse/issues
POST /api/v1/warehouse/issues/:id/post
POST /api/v1/warehouse/issues/:id/reverse

GET/POST /api/v1/warehouse/transfers
POST /api/v1/warehouse/transfers/:id/post

GET/POST /api/v1/warehouse/stock-counts
POST /api/v1/warehouse/stock-counts/:id/post

GET /api/v1/warehouse/inventory
GET /api/v1/warehouse/ledger
```

---

# 84. POSTING SERVICE

Business logic tập trung:

```text
InventoryPostingService
```

Không scatter ledger creation trong route handlers.

Concept:

```text
postReceipt()
postIssue()
postTransfer()
postAdjustment()
postStockCountVariance()
reverseDocument()
```

---

# 85. BALANCE QUERY SERVICE

Tạo service:

```text
getOnHand(item, warehouse)
getInventoryByWarehouse()
getInventoryByItem()
```

Không query SUM ledger tùy tiện ở mọi component.

---

# 86. XNK INTEGRATION CONTRACT

Chuẩn bị interface:

```text
CreateWarehouseReceiptFromShipment
```

Input:

```text
shipment_id
warehouse_id
lines
received_date
reference
```

Không cho XNK ghi ledger trực tiếp.

XNK phải gọi Warehouse domain service.

---

# 87. PARTIAL XNK RECEIPT

Một shipment có thể tạo nhiều receipt.

Warehouse phải expose:

```text
received quantity by external reference line
```

để XNK tính còn lại.

---

# 88. PROJECT MATERIAL REPORT HOOK

Có query:

```text
issues by project/worksite
```

để Project module sau hiển thị vật tư đã xuất.

Không duplicate data sang project table.

---

# 89. NOTIFICATION HOOK

Events:

```text
warehouse.receipt.posted
warehouse.issue.posted
warehouse.transfer.posted
warehouse.stock_count.posted
warehouse.low_stock
```

Không cần full notification engine.

---

# 90. UI — ITEM LIST

Desktop:

```text
Hàng hóa                           [+ Thêm hàng hóa]

[Tìm kiếm] [Nhóm] [Trạng thái]

Mã hàng | Tên hàng | Nhóm | ĐVT | Trạng thái | ...
```

Không show tồn kho tổng duy nhất nếu multi-warehouse dễ gây hiểu nhầm.

Có thể show:

```text
Tổng tồn
```

nếu label rõ.

---

# 91. UI — INVENTORY

```text
Tồn kho

[Kho] [Nhóm hàng] [Tìm kiếm]

Mã | Hàng hóa | ĐVT | Tồn | Tối thiểu | Trạng thái
```

Có:

```text
Xem theo kho
Xem theo hàng hóa
```

---

# 92. UI — RECEIPT/ISSUE

Form page, không modal lớn.

Header section + line table.

Sticky actions:

```text
Lưu nháp
Ghi sổ
```

Nếu cần approval:

```text
Gửi duyệt
```

---

# 93. UI — STOCK COUNT

Wizard/page:

```text
1. Chọn kho/phạm vi
2. Danh sách kiểm kê
3. Nhập số thực tế
4. Xem chênh lệch
5. Ghi nhận điều chỉnh
```

Routing thật hoặc route-backed steps.

Refresh không mất draft.

---

# 94. EMPTY / ERROR

Ví dụ:

```text
Kho chưa có hàng hóa.
```

```text
Không thể ghi sổ vì tồn kho không đủ.
```

Không raw DB error.

---

# 95. TEST CASES — MASTER DATA

- create item
- duplicate item code
- inactive item
- create warehouse
- inactive warehouse
- cannot delete item with ledger
- cannot delete warehouse with ledger

---

# 96. TEST CASES — RECEIPT

- draft
- post
- quantity increase
- duplicate post idempotency
- reverse
- attachment
- partial receipt reference

---

# 97. TEST CASES — ISSUE

- enough stock
- insufficient stock
- concurrent issues
- no negative stock
- override if policy/permission
- reverse

---

# 98. TEST CASES — TRANSFER

- source decreases
- destination increases
- atomic
- same warehouse invalid
- insufficient source
- retry idempotent

---

# 99. TEST CASES — STOCK COUNT

- snapshot expected
- counted equal
- positive variance
- negative variance
- post creates adjustment
- cannot post twice
- audit

---

# 100. TEST CASES — LEDGER/BALANCE

- ledger sum equals balance
- reverse restores
- materialized balance consistent
- reconciliation detects mismatch

---

# 101. TEST CASES — AUTHORIZATION

- user scoped warehouse
- direct URL another warehouse denied
- create but cannot post
- post permission works
- reverse permission separate

---

# 102. TEST CASES — XNK HOOK

- shipment reference receipt
- partial receipt
- second receipt
- total received calculation
- no direct ledger manipulation

---

# 103. ACCEPTANCE CRITERIA

## Master Data

- [ ] Item code unique.
- [ ] Category configurable.
- [ ] UOM configurable.
- [ ] Multi-warehouse.
- [ ] Inactive instead of deleting history.

## Documents

- [ ] Receipt.
- [ ] Issue.
- [ ] Transfer.
- [ ] Adjustment.
- [ ] Stock Count.
- [ ] Draft/Posted/Reversed lifecycle.
- [ ] Posted document immutable.

## Ledger

- [ ] Stock Ledger source of truth.
- [ ] No direct balance edit.
- [ ] Reversal supported.
- [ ] Balance consistent.
- [ ] Concurrency safe.
- [ ] Idempotent posting.

## Stock

- [ ] Multi-warehouse balance.
- [ ] Negative stock protected.
- [ ] Low-stock config.
- [ ] Inventory view.
- [ ] Ledger view.

## Project/XNK

- [ ] Project/worksite reference.
- [ ] XNK receipt integration-ready.
- [ ] Partial receipt supported.
- [ ] No duplicate item master.

## Security

- [ ] Warehouse scope.
- [ ] Post permission separate.
- [ ] Private attachments.
- [ ] No ledger edit endpoint.
- [ ] Audit.

## UI

- [ ] Routing thật.
- [ ] Form chứng từ là page.
- [ ] Stock Count workflow rõ.
- [ ] Desktop/tablet optimized.
- [ ] Mobile read/basic action usable.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Production build pass.
- [ ] Concurrency tests pass.

---

# 104. THỨ TỰ TRIỂN KHAI

1. Inspect existing item/warehouse data nếu có.
2. Thiết kế Item Master.
3. Thiết kế Warehouse.
4. Thiết kế UOM/Category.
5. Thiết kế Inventory Document lifecycle.
6. Thiết kế Stock Ledger.
7. Thiết kế Balance.
8. Thiết kế Posting Service.
9. Thiết kế Reversal.
10. Thiết kế Stock Count.
11. Thiết kế Project/XNK references.
12. Migrations/indexes.
13. Permissions/scopes.
14. Master APIs.
15. Receipt APIs.
16. Issue APIs.
17. Transfer APIs.
18. Count/Adjustment APIs.
19. Inventory/Ledger APIs.
20. Item UI.
21. Warehouse UI.
22. Receipt/Issue/Transfer UI.
23. Inventory UI.
24. Stock Count UI.
25. Dashboard.
26. Report Engine integration.
27. Audit.
28. Tests.
29. Concurrency/idempotency review.
30. Responsive/accessibility.
31. Lint/typecheck/build.
32. Báo cáo.

---

# 105. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Data model

- items
- warehouses
- documents
- ledger
- balances
- stock count

## Posting model

- transaction boundaries
- idempotency
- reversal
- negative stock protection

## Authorization

- permission
- warehouse scope

## UI

- routes
- document pages
- inventory pages

## Integration

- Project
- XNK
- Report Engine

## Tests

- business tests
- concurrency tests
- results

## Known limitations

Chỉ ghi limitation thật.

---

# 106. QUY TẮC CUỐI

Không edit tồn kho trực tiếp.

Không edit posted ledger.

Không sửa posted document âm thầm.

Không xóa chứng từ đã ảnh hưởng tồn.

Không cho negative stock do race condition.

Không để transfer source/destination lệch vì partial failure.

Không duplicate item master giữa Warehouse và XNK.

Không cho XNK ghi trực tiếp stock ledger.

Không implement accounting valuation nửa vời.

Không build barcode/lot/serial quá sớm nếu chưa cần.

Không giant warehouse page.

**Dừng sau khi Item Master + Warehouse + Receipt/Issue/Transfer + Stock Count + Ledger + Balance hoàn chỉnh, transaction-safe, test/build pass và báo cáo kết quả.**
