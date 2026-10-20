# Incident response

Severity: P0 = mất dữ liệu/security/gián đoạn toàn công ty; P1 = workflow critical bị chặn; P2/P3 = có workaround/không critical.

Khi nhận sự cố, ghi: thời gian, account ID/email công ty, màn hình, request/error ID, release SHA, ảnh đã loại PII. Không yêu cầu password/token.

Quy trình: triage → hạn chế tác động → giữ evidence/log → quyết định rollback/forward fix → xác minh dữ liệu → thông báo stakeholder → postmortem. Mẫu record gồm owner, timeline, impact, detection, root cause, corrective/preventive action và evidence links.

Alert tối thiểu: readiness fail, 5xx tăng, login failure spike, failed/oldest job, webhook dead-letter, DB/storage latency, backup verification stale, storage growth. Kênh và người trực phải được điền trước GO.
