# Go-live blockers — 2026-09-14

| ID | Severity | Blocker | Owner | Status | Target/evidence |
|---|---|---|---|---|---|
| GL-001 | P0 | Chưa có staging/production target và secret configuration review | IT/Infra | OPEN | URL + env review + release SHA |
| GL-002 | P0 | Chưa có backup DB/object storage thực tế và restore drill | IT/Infra | OPEN | restore evidence + measured RPO/RTO |
| GL-003 | P0 | Chưa có source migration/dry-run/reconciliation/sign-off | HR/Kho/XNK + IT | OPEN | validation report + checksums |
| GL-004 | P0 | UAT, GPS/camera/offline pilot chưa thực hiện | Business owners | OPEN | signed UAT/pilot evidence |
| GL-005 | P1 | Chưa review quyền của user thật/admin/export/post/approver | Management + IT | OPEN | permission extract được duyệt |
| GL-006 | P1 | Chưa xác nhận support/hypercare owner và escalation channel | Management | OPEN | contact roster |
| GL-007 | P1 | Malware scanner mới ở mức policy/hook, chưa tích hợp | IT/Security | OPEN | scanner hoặc accepted risk |
| GL-008 | P2 | 2 moderate dependency advisories từ ExcelJS/uuid | Engineering | OPEN | compatible upgrade + Excel regression hoặc accepted risk |

Các blocker này phụ thuộc môi trường/người chịu trách nhiệm; không được tự đóng bằng code-only evidence.
