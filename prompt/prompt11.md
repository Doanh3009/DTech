# PROMPT 11 — QUẢN LÝ XUẤT NHẬP KHẨU: HỢP ĐỒNG/PO, SHIPMENT, CONTAINER, CHỨNG TỪ, ETD/ETA, THÔNG QUAN VÀ LIÊN KẾT KHO

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
- điểm danh công nhân
- nghỉ phép / approval / phép năm / PDF
- bảng công / khóa kỳ / Excel
- cập nhật dự án / dashboard
- quản lý Kho với Item Master, Stock Ledger, Receipt/Issue/Transfer/Stock Count
- API-first
- configuration over hard-code
- audit foundation
- private file storage

Prompt này triển khai **module Xuất nhập khẩu**.

Đây là module nghiệp vụ nặng, cần đặc biệt tránh kiểu chỉ lưu vài field:

```text
Shipment
ETA
Status
```

Mà phải quản lý theo chuỗi nghiệp vụ:

```text
Hợp đồng / PO
↓
Shipment
↓
Container / Packages
↓
Shipping Documents
↓
ETD / ETA
↓
Customs Clearance
↓
Arrival
↓
Warehouse Receipt
↓
Received Quantity / Variance
```

Module XNK không được ghi trực tiếp vào Stock Ledger.

Mọi biến động tồn kho phải đi qua **Warehouse domain service** của Prompt 10.

---

# 1. MỤC TIÊU

Xây module XNK có khả năng:

1. Quản lý hợp đồng / PO / đơn mua liên quan nhập khẩu.
2. Quản lý Shipment.
3. Quản lý nhiều chuyến cho một hợp đồng.
4. Quản lý container.
5. Quản lý line hàng trong shipment.
6. Quản lý chứng từ.
7. Theo dõi ETD.
8. Theo dõi ETA.
9. Lưu lịch sử thay đổi ETA.
10. Theo dõi tình trạng vận chuyển.
11. Theo dõi thông quan.
12. Theo dõi hàng về.
13. Theo dõi nhận hàng.
14. Tạo phiếu nhập kho từ shipment.
15. Hỗ trợ nhận hàng nhiều lần.
16. Hỗ trợ thiếu/thừa hàng.
17. Liên kết Item Master của Kho.
18. Liên kết supplier/partner.
19. Dashboard lô hàng.
20. Cảnh báo shipment cần chú ý.
21. Quản lý tài liệu riêng tư.
22. Audit.
23. Export/report hook.
24. Chuẩn bị tích hợp API với forwarder/carrier nếu có sau này.

Không triển khai full accounting/payment/LC banking trong prompt này nếu chưa có yêu cầu cụ thể.

---

# 2. NGUYÊN TẮC CỐT LÕI

Không coi Shipment là một record độc lập không quan hệ.

Mối quan hệ phải rõ:

```text
Supplier / Partner
↓
Purchase Contract / PO
↓
Shipment
↓
Shipment Lines
↓
Containers
↓
Documents
↓
Customs
↓
Warehouse Receipts
```

---

# 3. KHÔNG DUPLICATE ITEM MASTER

XNK phải dùng cùng:

```text
items
```

từ module Kho.

Không tạo:

```text
import_items
```

riêng có mã hàng khác.

Shipment line reference:

```text
item_id
```

Có thể lưu snapshot:

```text
item_code_snapshot
item_name_snapshot
specification_snapshot
```

để giữ lịch sử.

---

# 4. SUPPLIER / BUSINESS PARTNER

Nếu project chưa có Partner module, xây abstraction tối thiểu.

Mỗi supplier:

```text
Mã đối tác
Tên đối tác *
Tên giao dịch
Quốc gia
Địa chỉ
Email
Điện thoại
Người liên hệ
Tax/business registration nếu cần
Trạng thái
Ghi chú
```

Không nhét supplier name dạng string trong shipment nếu có entity riêng.

---

# 5. PARTNER KHÔNG CHỈ LÀ SUPPLIER — FUTURE READY

Architecture nên hỗ trợ partner type:

```text
Supplier
Forwarder
Carrier
Customs Broker
Customer
Other
```

Không cần full CRM.

---

# 6. CONTRACT / PO

Tạo entity:

```text
Purchase Contract / Import Order
```

Field tối thiểu:

```text
Số hợp đồng / PO *
Supplier *
Ngày ký / ngày đặt hàng
Currency
Incoterm nếu có
Payment term nếu cần
Expected delivery
Status
Note
Attachments
```

Không triển khai payment accounting.

---

# 7. CONTRACT STATUS

Ví dụ:

```text
DRAFT
ACTIVE
PARTIALLY_SHIPPED
COMPLETED
CANCELLED
```

Không chỉ boolean.

---

# 8. CONTRACT LINES

Mỗi contract/PO line:

```text
item_id
description snapshot
ordered_quantity
uom
unit_price optional
currency
expected_delivery_date optional
note
```

Không bắt giá nếu công ty chỉ muốn tracking logistics.

---

# 9. SHIPMENT

Một contract có thể có nhiều shipment.

Ví dụ:

```text
Contract PO-2026-001
Ordered 300 tons
↓
Shipment 1: 100 tons
Shipment 2: 120 tons
Shipment 3: 80 tons
```

Không assume 1 contract = 1 shipment.

---

# 10. SHIPMENT NUMBER

Mã nội bộ:

```text
SHP-2026-000123
```

Có thể lưu thêm:

```text
Booking No
Bill of Lading No
Forwarder Reference
Carrier Reference
```

Không dùng BL No làm primary ID vì có thể thay đổi / chưa có lúc tạo shipment.

---

# 11. SHIPMENT DATA

Field:

```text
Internal shipment number *
Contract / PO reference
Supplier *
Shipment type
Transport mode
Origin
Destination
Port of Loading
Port of Discharge
Carrier
Forwarder
Booking No
BL No
ETD
Current ETA
Actual departure
Actual arrival
Status
Incoterm snapshot
Currency if needed
Notes
```

---

# 12. TRANSPORT MODE

Config/enum:

```text
SEA
AIR
ROAD
RAIL
COURIER
OTHER
```

Không hard-code chỉ đường biển.

Nhưng V1 UI có thể ưu tiên SEA nếu nghiệp vụ công ty chủ yếu nhập container.

---

# 13. SHIPMENT STATUS

Phải rõ lifecycle.

Gợi ý:

```text
PLANNED
BOOKED
IN_TRANSIT
ARRIVED_PORT
CUSTOMS_PROCESSING
CUSTOMS_CLEARED
DELIVERING_TO_WAREHOUSE
PARTIALLY_RECEIVED
RECEIVED
COMPLETED
CANCELLED
```

Không dùng một status text tùy ý.

---

# 14. STATUS KHÔNG ĐƯỢC TỰ SỬA TÙY TIỆN

Một số transition có thể tự suy ra:

```text
warehouse receipt created
→ PARTIALLY_RECEIVED
```

Nếu nhận đủ:

```text
→ RECEIVED
```

Nhưng không cần build complex workflow engine.

Transition service phải deterministic.

---

# 15. SHIPMENT LINES

Mỗi shipment line:

```text
item_id *
contract_line_id optional
expected_quantity *
uom
package_count optional
gross_weight optional
net_weight optional
volume optional
marks/numbers optional
note
```

Có snapshot:

```text
item_code
item_name
specification
```

---

# 16. KHÔNG SỬA EXPECTED QTY ÂM THẦM SAU KHI ĐÃ NHẬN HÀNG

Nếu shipment đã có warehouse receipt:

Thay đổi expected qty phải:

- permission cao
- reason
- audit
- warning impact

Không rewrite history.

---

# 17. CONTAINER MANAGEMENT

Một shipment có thể có:

```text
0
1
nhiều container
```

Container fields:

```text
Container No *
Seal No
Container Type
Size
Gross weight
Tare weight optional
Status
Note
```

Không bắt container cho air shipment.

---

# 18. CONTAINER TYPE

Ví dụ:

```text
20GP
40GP
40HQ
20OT
40OT
FR
Other
```

Configurable nếu cần.

---

# 19. CONTAINER STATUS

Ví dụ:

```text
PLANNED
LOADED
IN_TRANSIT
ARRIVED
CUSTOMS_CLEARED
DELIVERED
EMPTY_RETURNED
```

Không cần quá phức tạp nếu V1 chỉ tracking.

---

# 20. LINE ↔ CONTAINER ALLOCATION — FUTURE READY

Nếu cần biết hàng nào nằm container nào:

Có table:

```text
shipment_line_container_allocations
```

Field:

```text
shipment_line_id
container_id
quantity
```

V1 có thể triển khai nếu nghiệp vụ thực sự dùng.

Nếu chưa cần, architecture support.

---

# 21. DOCUMENT MANAGEMENT

Mỗi shipment có nhiều documents.

Ví dụ:

```text
Commercial Invoice
Packing List
Bill of Lading
Certificate of Origin
Insurance
Customs Declaration
Inspection Certificate
Delivery Order
Arrival Notice
Other
```

Không lưu tất cả vào một attachment list không type.

---

# 22. DOCUMENT TYPE

Admin có thể cấu hình:

```text
document_type
required_for_import?
required_before_customs?
expiry_date applicable?
```

Không xây arbitrary legal workflow.

---

# 23. DOCUMENT RECORD

Fields:

```text
shipment_id
document_type
document_number
issue_date
expiry_date optional
issuer
file_id
status
note
uploaded_by
uploaded_at
```

Storage private.

---

# 24. DOCUMENT STATUS

Ví dụ:

```text
MISSING
RECEIVED
VALID
EXPIRED
REPLACED
```

Không cần mọi type dùng cùng status nếu không phù hợp.

---

# 25. REQUIRED DOCUMENT CHECKLIST

Shipment detail có checklist:

```text
Invoice        ✓
Packing List   ✓
B/L            ✓
C/O            Chưa có
Customs Doc    Chưa có
```

Checklist dựa trên document type config / shipment type.

Không hard-code mọi shipment phải có cùng bộ chứng từ.

---

# 26. ETD

Lưu:

```text
planned_etd
current_etd
actual_departure
```

Nếu chỉ cần current ETD thì vẫn nên có history nếu thay đổi.

---

# 27. ETA

Rất quan trọng.

Không chỉ overwrite:

```text
eta = new date
```

Phải lưu history.

Concept:

```text
shipment_schedule_events
```

Ví dụ:

```text
01/09
ETA: 15/09

05/09
ETA changed: 15/09 → 18/09
Reason: Vessel delay

12/09
ETA changed: 18/09 → 20/09
```

---

# 28. ETA HISTORY

Fields:

```text
shipment_id
schedule_type
old_value
new_value
reason
source
changed_by
changed_at
```

Source:

```text
MANUAL
FORWARDER
CARRIER_API future
SYSTEM
```

---

# 29. UI ETA HISTORY

Shipment detail:

```text
ETA hiện tại
20/09/2026

Lịch sử:
12/09  18/09 → 20/09
05/09  15/09 → 18/09
```

Không chỉ show current ETA.

---

# 30. ACTUAL ARRIVAL

Khi hàng cập cảng:

```text
actual_arrival
```

Không thay ETA bằng actual date.

Phân biệt:

```text
ETA
Actual Arrival
```

---

# 31. CUSTOMS CLEARANCE

Tạo subdomain đơn giản.

Fields:

```text
customs_status
declaration_number
declaration_date
customs_broker
customs_clearance_date
channel optional
note
attachments
```

Không làm hệ thống khai hải quan điện tử.

Chỉ tracking trạng thái/chứng từ.

---

# 32. CUSTOMS STATUS

Gợi ý:

```text
NOT_STARTED
PREPARING_DOCUMENTS
DECLARED
INSPECTION
PENDING_DUTY
CLEARED
ISSUE
```

Có thể config label.

---

# 33. CUSTOMS ISSUE

Nếu customs_status = ISSUE:

Field:

```text
issue_note *
severity optional
```

Dashboard có thể flag.

Không cần Project Issue engine nếu domain riêng đơn giản.

---

# 34. TAX/DUTY — CHỈ TRACKING CƠ BẢN

Có thể lưu optional:

```text
import_duty
vat
other_charges
currency
```

nhưng không làm accounting.

Nếu chưa cần, để future.

---

# 35. DELIVERY TO WAREHOUSE

Sau customs clearance:

```text
Port
↓
Truck/Delivery
↓
Warehouse
```

Có thể lưu:

```text
delivery_status
planned_delivery_date
actual_delivery_date
warehouse_id
truck/reference
```

Không cần Fleet module.

---

# 36. WAREHOUSE RECEIPT INTEGRATION

Đây là phần bắt buộc.

XNK không được tạo stock ledger trực tiếp.

Flow:

```text
Shipment
↓
Create Warehouse Receipt
↓
Warehouse Service validates
↓
Receipt Draft
↓
Warehouse user reviews
↓
Post
↓
Stock Ledger
```

---

# 37. NÚT TẠO PHIẾU NHẬP

Shipment detail:

```text
[ Tạo phiếu nhập kho ]
```

Chỉ khi:

- shipment có line
- warehouse target được chọn
- user có permission phù hợp
- shipment status cho phép nhận hàng

Không auto post.

---

# 38. PREFILL RECEIPT

Khi tạo receipt:

Header prefill:

```text
Reference = Shipment number
Supplier
Warehouse
Date
Shipment ID
```

Lines:

```text
Item
Remaining quantity expected
UOM
```

User nhập:

```text
Actual received quantity
```

---

# 39. PARTIAL RECEIPT

Ví dụ:

Shipment line:

```text
Expected: 100
```

Receipt 1:

```text
Received: 60
```

Remaining:

```text
40
```

Receipt 2:

```text
Received: 40
```

Total:

```text
100
```

Không khóa shipment sau receipt đầu tiên.

---

# 40. RECEIVED QUANTITY

Không lưu một field mutable duy nhất:

```text
shipment_line.received_qty
```

làm source of truth nếu có thể derive từ posted warehouse receipts.

Có thể cache summary.

Source of truth:

```text
posted warehouse receipt lines reference shipment line
```

---

# 41. OVER-RECEIPT

Nếu expected 100 nhưng actual 103:

Policy:

```text
allow_over_receipt
tolerance_percent
```

Không hard-code.

UI:

```text
Dư 3 đơn vị so với dự kiến.
```

Require reason nếu vượt tolerance.

---

# 42. SHORT-RECEIPT

Nếu nhận 97/100:

Shipment có thể:

```text
PARTIALLY_RECEIVED
```

Nếu xác nhận không còn nhận thêm:

Có action:

```text
Đóng phần thiếu
```

Reason required.

Không auto completed nếu thiếu.

---

# 43. DAMAGE / REJECTED QUANTITY

Có thể track:

```text
received_good_qty
damaged_qty
rejected_qty
```

nếu công ty cần.

Nếu chưa cần, architecture support receipt discrepancy.

Không làm Quality Management module đầy đủ.

---

# 44. RECEIPT VARIANCE

Shipment detail:

```text
Expected
Received
Remaining
Variance
```

Theo line.

Color semantic nhẹ.

---

# 45. SHIPMENT COMPLETION

Shipment chỉ COMPLETE khi:

- logistics completed
- customs completed hoặc appropriate status
- receiving resolved
- no unresolved critical discrepancy

Không auto complete chỉ vì `actual_arrival` có giá trị.

---

# 46. CLOSED SHIPMENT

Closed/completed:

- vẫn xem được
- không xóa docs
- không xóa receipt links
- ETA history giữ nguyên
- edit restricted

---

# 47. CANCELLED SHIPMENT

Nếu shipment cancelled trước khi nhận:

- status CANCELLED
- reason
- audit

Nếu đã có posted receipt:

Không cho cancel đơn giản.

Cần reversal / business handling.

---

# 48. ROUTING

Bắt buộc route thật.

Ví dụ:

```text
/import-export
/import-export/contracts
/import-export/contracts/new
/import-export/contracts/:id

/import-export/shipments
/import-export/shipments/new
/import-export/shipments/:id/overview
/import-export/shipments/:id/lines
/import-export/shipments/:id/containers
/import-export/shipments/:id/documents
/import-export/shipments/:id/customs
/import-export/shipments/:id/receiving
/import-export/shipments/:id/history

/import-export/partners
/import-export/documents

/settings/import-export
```

Không giant shipment page.

---

# 49. SHIPMENT LIST

Desktop table:

```text
Shipment
Supplier
Contract
Mode
Origin
Destination
ETD
ETA
Status
Customs
Receiving
```

Filter:

```text
Status
Supplier
Mode
ETA range
Customs status
Receiving status
Need attention
```

---

# 50. SHIPMENT DETAIL HEADER

Ví dụ:

```text
SHP-2026-000123

Supplier ABC
Shanghai → Cát Lái

IN TRANSIT

ETD: 01/09/2026
ETA: 20/09/2026
```

Tabs route-backed.

---

# 51. OVERVIEW

Hiển thị:

```text
Status
Supplier
Contract
Origin
Destination
Carrier
Forwarder
ETD
ETA
Actual arrival

Containers
Documents checklist
Customs status
Receiving progress
Open issues
```

Không nhồi quá nhiều raw detail.

---

# 52. RECEIVING PROGRESS

Ví dụ:

```text
Đã nhận: 180 / 200 tấn
90%
```

Ở đây % hợp lý vì có numerator/denominator thực tế.

Không dùng % cảm tính.

---

# 53. DOCUMENT TAB

Table:

```text
Loại chứng từ
Số
Ngày
Trạng thái
File
Người upload
```

Action:

```text
Upload
Replace
View
Archive
```

Không overwrite file cũ không history.

---

# 54. DOCUMENT VERSION

Nếu B/L được thay:

```text
Version 1
Version 2
```

hoặc record `REPLACED`.

Không delete lịch sử nếu chứng từ quan trọng.

---

# 55. FILE SECURITY

Private storage.

Viewer:

```text
authenticated
↓
shipment permission
↓
document permission
↓
temporary access
```

Không public URL.

---

# 56. PARTNER DOCUMENTS

Có thể lưu documents của partner riêng nếu future.

Không cần trong scope này.

---

# 57. SHIPMENT ACTIVITY HISTORY

Timeline:

```text
Shipment created
Booking confirmed
ETD changed
Departed
ETA changed
Document uploaded
Customs declared
Customs cleared
Warehouse receipt created
Receipt posted
Shipment completed
```

Human-readable.

Không raw audit JSON.

---

# 58. NEED ATTENTION LOGIC

Dashboard flag nếu:

```text
ETA delayed
Required document missing
Customs ISSUE
Arrival passed but not received
Short receipt unresolved
Shipment stale
```

Không cần AI.

Rule-based.

---

# 59. DELAY DETECTION

Ví dụ:

```text
current_eta > original_eta + threshold
```

Hoặc:

```text
ETA changed later
```

Label:

```text
ETA trễ 3 ngày
```

Không tự gọi "nghiêm trọng" nếu policy chưa nói.

---

# 60. DOCUMENT MISSING

Nếu required doc chưa có trước customs:

```text
Thiếu chứng từ: C/O
```

Dashboard attention.

---

# 61. CUSTOMS DELAY

Nếu customs status:

```text
DECLARED
```

quá N ngày mà chưa cleared:

Flag:

```text
Thông quan đang kéo dài
```

Threshold config.

---

# 62. ARRIVAL NOT RECEIVED

Nếu:

```text
actual_arrival có
```

nhưng sau N ngày chưa có receipt:

Flag.

Không assume error nếu delivery plan sau.

Threshold config.

---

# 63. IMPORT-EXPORT DASHBOARD

Route:

```text
/import-export
```

Summary:

```text
Đang vận chuyển
Sắp đến
Đang thông quan
Chờ nhận kho
Cần chú ý
```

Không quá nhiều chart.

---

# 64. UPCOMING ARRIVALS

Section:

```text
SẮP VỀ
```

Hiển thị:

```text
Shipment
Supplier
ETA
Port
Status
```

Sort ETA ascending.

---

# 65. NEEDS ATTENTION

Section:

```text
CẦN CHÚ Ý
```

Ví dụ:

```text
SHP-001
ETA trễ 4 ngày

SHP-002
Thiếu C/O

SHP-003
Đã cập cảng nhưng chưa nhận kho
```

---

# 66. MOBILE

XNK ưu tiên desktop.

Mobile cần:

- xem shipment
- xem ETA/status
- xem documents
- upload ảnh/PDF nhanh
- update ETA/status đơn giản nếu có permission

Không ép full complex contract editor trên mobile.

---

# 67. MANUAL ETA UPDATE UX

Action:

```text
Cập nhật ETA
```

Field:

```text
ETA mới *
Lý do
Nguồn
```

UI phải show:

```text
ETA hiện tại: 18/09
ETA mới: 20/09
```

Save → history.

---

# 68. ETA SOURCE

Source:

```text
Forwarder
Carrier
Supplier
Manual internal
API future
```

Không cần partner-specific API ở V1.

---

# 69. FORWARDER / CARRIER INTEGRATION — FUTURE READY

Chuẩn bị interface:

```text
ShipmentTrackingProvider
```

Future:

```text
update vessel status
ETA
arrival
```

Nhưng không implement web scraping.

Không phụ thuộc external API nếu chưa có.

---

# 70. TRACKING EVENT — FUTURE READY

Có thể support:

```text
DEPARTED
TRANSSHIPMENT
ARRIVED
CUSTOMS
DELIVERED
```

Không cần build map tracking.

---

# 71. NO MAP NEEDED

Không cần bản đồ live vessel ở V1.

Đây là internal operations system, không phải logistics tracking consumer app.

---

# 72. CONTRACT FULFILLMENT

Contract detail nên show:

```text
Ordered
Shipped
Received
Remaining
```

Theo line.

Source:

```text
Shipment lines
Posted receipts
```

Không nhập tay.

---

# 73. CONTRACT COMPLETION

Contract can complete khi all relevant ordered quantities resolved.

Không auto complete nếu shipment cancelled/short without closure decision.

---

# 74. CONTRACT VARIANCE

Show:

```text
Ordered 300
Shipped 295
Received 292
Remaining/Short 8
```

Không cần financial reconciliation.

---

# 75. PURCHASE ORDER VS CONTRACT

Nếu công ty không dùng PO riêng, có thể dùng một entity:

```text
Import Contract
```

Không buộc cả hai.

Architecture có thể đặt tên:

```text
ProcurementOrder
```

nhưng UI phải theo thuật ngữ công ty dùng.

---

# 76. ADMIN CONFIG

Route:

```text
/settings/import-export
```

Cho cấu hình:

```text
Shipment status labels nếu allowed
Document types
Required document rules
Transport modes
Container types
Customs status
Over receipt tolerance
Attention thresholds
```

Không cho raw workflow code.

---

# 77. NUMBERING CONFIG

Có thể cấu hình prefix:

```text
SHP
PO
```

Nhưng không làm numbering builder quá phức tạp.

Concurrency-safe.

---

# 78. PERMISSIONS

Gợi ý:

```text
import_export.view
import_export.view_all

import_contract.view
import_contract.create
import_contract.edit
import_contract.close

shipment.view
shipment.create
shipment.edit
shipment.update_schedule
shipment.close
shipment.cancel

shipment_document.view
shipment_document.upload
shipment_document.replace

customs.view
customs.manage

shipment_receiving.view
shipment_receiving.create_receipt

partner.view
partner.manage

import_export.report.export
```

Không hard-code role.

---

# 79. SCOPE

Có thể support:

```text
all shipments
assigned shipments
department scope
```

Nếu công ty nhỏ, all-scope cho XNK team.

Nhưng server authorization phải có cấu trúc scope.

---

# 80. AUDIT

Audit:

```text
contract created/edited
shipment created
shipment status changed
ETD/ETA changed
container added
document uploaded/replaced
customs status changed
warehouse receipt created
short/over receipt resolved
shipment completed/cancelled
```

Không log file binary.

---

# 81. REASON REQUIRED

Require reason cho:

- ETA changed significantly nếu policy
- cancelling shipment
- changing expected quantity after receiving
- closing short receipt
- over receipt beyond tolerance
- replacing critical document nếu needed

Không bắt reason cho mọi typo.

---

# 82. CONCURRENCY

Nếu hai users update ETA:

- optimistic locking
- second user sees conflict

Không silent overwrite.

---

# 83. IDEMPOTENCY

Create warehouse receipt from shipment phải idempotent.

Double-click không tạo hai receipt draft giống nhau nếu cùng client request.

Nhưng partial receipt sau này phải tạo được receipt mới chủ động.

---

# 84. RECEIPT REFERENCE UNIQUENESS

Warehouse receipt line phải store:

```text
shipment_line_id
```

và quantity.

Không dùng description text để reconcile.

---

# 85. WAREHOUSE POST EVENT

Khi Warehouse posts receipt:

Emit:

```text
warehouse.receipt.posted
```

XNK listener/service update derived receiving summary.

Không direct update stock.

---

# 86. RECEIPT REVERSE EVENT

Nếu Warehouse reverse receipt:

XNK receiving summary phải giảm lại.

Không giữ cached received qty sai.

---

# 87. EVENT CONSISTENCY

Nếu event architecture chưa có reliable queue, có thể compute receiving summary trực tiếp từ Warehouse data/query.

Ưu tiên correctness hơn overengineering.

---

# 88. DATABASE MODEL GỢI Ý

Không bắt buộc tên chính xác.

```text
business_partners

import_contracts
import_contract_lines

shipments
shipment_lines

shipment_containers
shipment_line_container_allocations optional

shipment_documents
shipment_document_versions optional

shipment_schedule_history

shipment_customs

shipment_delivery_info optional

shipment_status_history
```

Warehouse receipt relationship dùng foreign key/reference thích hợp.

---

# 89. SHIPMENT LINE RECEIVING VIEW

Có query:

```text
expected_qty
posted_received_qty
reversed_qty effect
remaining_qty
variance
```

Không mutate manually.

---

# 90. INDEXES

Index:

```text
shipment_number
supplier_id
status
eta
etd
contract_id
customs_status
shipment_line_id
document_type
container_no
```

Không scan toàn bảng cho dashboard.

---

# 91. API GỢI Ý

Partners:

```text
GET/POST/PATCH /api/v1/partners
```

Contracts:

```text
GET/POST /api/v1/import-contracts
GET/PATCH /api/v1/import-contracts/:id
GET /api/v1/import-contracts/:id/fulfillment
```

Shipments:

```text
GET/POST /api/v1/shipments
GET/PATCH /api/v1/shipments/:id

POST /api/v1/shipments/:id/update-etd
POST /api/v1/shipments/:id/update-eta
POST /api/v1/shipments/:id/status
```

Documents:

```text
GET/POST /api/v1/shipments/:id/documents
POST /api/v1/shipment-documents/:id/replace
```

Customs:

```text
GET/PATCH /api/v1/shipments/:id/customs
```

Receiving:

```text
GET /api/v1/shipments/:id/receiving
POST /api/v1/shipments/:id/create-warehouse-receipt
```

Dashboard:

```text
GET /api/v1/import-export/dashboard
GET /api/v1/import-export/attention
```

---

# 92. CREATE RECEIPT API

Không nhận:

```text
signed stock delta
```

Chỉ nhận business payload:

```text
shipment_id
warehouse_id
received_date
lines:
  shipment_line_id
  quantity
  note
```

Sau đó gọi Warehouse domain service.

---

# 93. SERVER VALIDATION

Validate:

- shipment exists
- shipment active
- line belongs to shipment
- item matches
- quantity > 0
- warehouse active
- remaining qty / tolerance
- permission
- receiving status
- idempotency
- no arbitrary line injection

---

# 94. DOCUMENT FILE VALIDATION

Validate:

- MIME
- size
- extension
- PDF/image/office whitelist nếu cần
- no executable
- no public path

---

# 95. REPORT ENGINE INTEGRATION

Reuse Prompt 08.

Report types:

```text
IMPORT_SHIPMENTS
IMPORT_CONTRACT_FULFILLMENT
SHIPMENT_DOCUMENT_CHECKLIST
SHIPMENT_RECEIVING
CUSTOMS_STATUS
```

Không tạo export engine mới.

---

# 96. EXCEL DEFAULT FIELDS

Shipment export:

```text
Shipment No
Supplier
Contract
Mode
Origin
Destination
ETD
ETA
Actual Arrival
Status
Customs Status
Expected Qty
Received Qty
Remaining Qty
```

Không export raw file URL.

Document link:

```text
Xem chứng từ
```

stable internal route.

---

# 97. DOCUMENT STABLE LINK

Excel link hoặc UI deep link:

```text
/import-export/shipments/:id/documents
```

hoặc document viewer route.

Permission check.

Không signed URL hết hạn trong Excel.

---

# 98. DASHBOARD PERFORMANCE

Compute summary bằng query/index hợp lý.

Không fetch full shipment + all documents + all lines để chỉ đếm 5 số.

---

# 99. TEST CASES — CONTRACT

- create contract
- multiple lines
- multiple shipments
- shipped qty summary
- received qty summary
- cancel one shipment
- completion remains correct

---

# 100. TEST CASES — SHIPMENT

- create shipment
- sea shipment with containers
- air shipment without containers
- status transitions
- ETA history
- actual arrival
- closed shipment restrictions

---

# 101. TEST CASES — DOCUMENTS

- upload invoice
- missing C/O
- replace B/L
- private access
- permission denied
- version/history preserved

---

# 102. TEST CASES — ETA

- first ETA
- update ETA
- multiple changes
- history order
- concurrent edit conflict
- dashboard delay flag

---

# 103. TEST CASES — CUSTOMS

- not started
- declared
- issue
- cleared
- dashboard attention
- file attachment

---

# 104. TEST CASES — RECEIVING

- expected 100
- first receipt 60
- post
- summary received 60
- second receipt 40
- total 100
- shipment received

Short receipt:

- expected 100
- received 95
- close short with reason
- completed appropriately

Over receipt:

- expected 100
- receive 103
- tolerance check
- reason if required

Reverse:

- posted 60
- reverse warehouse receipt
- shipment summary returns appropriately

---

# 105. TEST CASES — AUTHORIZATION

- user can view assigned/all scope
- unauthorized shipment direct URL denied
- document permission separate
- create receipt permission separate
- customs manage separate

---

# 106. TEST CASES — IDEMPOTENCY

- double create receipt click
- no duplicate receipt
- deliberate second partial receipt still works
- duplicate ETA submission no duplicate history if same request key

---

# 107. ACCEPTANCE CRITERIA

## Contracts / Partners

- [ ] Supplier entity.
- [ ] Contract/PO.
- [ ] Contract lines.
- [ ] Multiple shipments per contract.
- [ ] Fulfillment summary.

## Shipment

- [ ] Stable shipment number.
- [ ] Structured lines.
- [ ] Transport mode.
- [ ] Lifecycle status.
- [ ] ETD/ETA.
- [ ] ETA history.
- [ ] Actual arrival.
- [ ] Containers where applicable.

## Documents

- [ ] Typed document records.
- [ ] Required checklist.
- [ ] Private storage.
- [ ] Replace/history.
- [ ] No public URLs.

## Customs

- [ ] Structured status.
- [ ] Declaration info.
- [ ] Issue tracking.
- [ ] Clearance date.

## Receiving

- [ ] Warehouse integration.
- [ ] XNK never writes Stock Ledger directly.
- [ ] Partial receipts.
- [ ] Over receipt policy.
- [ ] Short receipt handling.
- [ ] Reverse reflected correctly.
- [ ] Received qty derived from posted warehouse receipts.

## Dashboard

- [ ] Upcoming arrivals.
- [ ] Needs attention.
- [ ] ETA delay.
- [ ] Missing documents.
- [ ] Customs issue.
- [ ] Arrival not received.

## Security

- [ ] Server-side permissions.
- [ ] Private documents.
- [ ] Scope.
- [ ] Audit.

## Architecture

- [ ] No duplicate Item Master.
- [ ] Route-backed shipment tabs.
- [ ] No giant shipment page.
- [ ] Report Engine reuse.
- [ ] Future tracking-provider ready.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Production build pass.
- [ ] Receiving integration tests pass.
- [ ] Responsive desktop/mobile review pass.

---

# 108. THỨ TỰ TRIỂN KHAI

1. Inspect Warehouse Item Master và Receipt API.
2. Thiết kế Partner.
3. Thiết kế Contract/PO.
4. Thiết kế Contract Lines.
5. Thiết kế Shipment.
6. Thiết kế Shipment Lines.
7. Thiết kế Containers.
8. Thiết kế Documents.
9. Thiết kế ETD/ETA history.
10. Thiết kế Customs tracking.
11. Thiết kế Receiving integration.
12. Migrations/indexes.
13. Permissions/scopes.
14. Partner APIs.
15. Contract APIs.
16. Shipment APIs.
17. Document APIs.
18. Customs APIs.
19. Receiving API gọi Warehouse service.
20. Dashboard queries.
21. Desktop Shipment UI.
22. Contract UI.
23. Documents UI.
24. Customs UI.
25. Receiving UI.
26. Mobile read/update views.
27. Report Engine integration.
28. Audit.
29. Tests.
30. Concurrency/idempotency review.
31. Responsive/accessibility.
32. Lint/typecheck/build.
33. Báo cáo.

---

# 109. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Data model

- partner
- contract
- shipment
- lines
- containers
- documents
- ETA history
- customs

## Receiving

- Warehouse integration
- partial receipt
- over/short receipt
- reverse behavior

## Dashboard

- attention rules
- upcoming arrivals

## Authorization

- permissions
- scope

## UI Routes

- contracts
- shipments
- documents
- customs
- receiving

## Report integration

- report types
- stable document links

## Tests

- cases
- results

## Known limitations

Chỉ ghi limitation thật.

---

# 110. QUY TẮC CUỐI

Không duplicate Item Master.

Không ghi Stock Ledger từ XNK.

Không overwrite ETA không history.

Không coi ETA là Actual Arrival.

Không hard-code một bộ chứng từ cho mọi shipment.

Không assume 1 contract = 1 shipment.

Không assume 1 shipment = 1 warehouse receipt.

Không khóa partial receiving.

Không cho over/short receipt mất dấu.

Không public chứng từ.

Không làm accounting/LC/banking nửa vời.

Không build live vessel map nếu chưa cần.

Không giant XNK page.

**Dừng sau khi Partner + Contract/PO + Shipment + Containers + Documents + ETA/Customs + Warehouse Receiving Integration hoàn chỉnh, test/build pass và báo cáo kết quả.**
