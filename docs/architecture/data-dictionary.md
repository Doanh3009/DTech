# Core data dictionary

| Entity | Purpose / important relation |
|---|---|
| Employee | nhân sự master; liên kết department/position và sensitive profile |
| App Account | mapping Supabase auth user → employee/status; role qua account_roles |
| App Session | phiên có revoke/expiry/last activity; không lưu raw refresh token |
| Attendance Event | sự kiện chấm vào/ra cá nhân, idempotent theo nguồn/client key |
| Worker Attendance Session | roster điểm danh công trường; ảnh thuộc session/worker evidence |
| Project Assignment | phạm vi employee trên project/worksite |
| Leave Request / Leave Ledger | workflow xin nghỉ và sổ phép chính thức append/adjust |
| Daily Timesheet / Period | kết quả ngày và kỳ có version/lock |
| Inventory Document | receipt/issue/transfer/adjustment/count/reversal; post sinh ledger |
| Stock Ledger / Balance | immutable movement và current projection |
| Shipment | hợp đồng/lô/ETA/customs/receiving; receiving liên kết warehouse receipt |
| Approval Case / Step | workflow snapshot, assignee, decision/audit |
| Document / File Asset | business metadata/version và storage object metadata |
| Audit Log | actor/action/entity/before/after/reason/correlation |
| Integration Job/Webhook | queue/idempotency/attempt/error summary |
| Migration Batch | source checksum/mode/count/status/error evidence |

Natural/business keys và FK/unique/check constraints nằm trong migrations; UUID không thay cho reconciliation business key.
