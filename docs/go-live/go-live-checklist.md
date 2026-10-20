# Go-live checklist

- [ ] CI xanh trên đúng release SHA; dependency audit không có high/critical chưa xử lý.
- [ ] Staging/production tách biệt; env và secret lengths được kiểm tra, không có secret trong client bundle/log.
- [ ] Supabase migrations áp dụng đúng thứ tự; backup trước migration risk cao.
- [ ] First admin invite an toàn; account test/demo bị disable; danh sách role/sensitive export/warehouse post/API manager được duyệt.
- [ ] Source checksum, dry-run, error handling, delta migration và reconciliation được business ký.
- [ ] Backup DB + object storage hoạt động; restore drill staging PASS; RPO/RTO đo thực.
- [ ] UAT các module, GPS/camera/offline pilot và PDF/Excel thực tế PASS.
- [ ] Health/readiness/log/request ID/alerts/job queue/storage monitoring được kiểm tra.
- [ ] Support owner/channel/escalation và hypercare roster đã công bố; user guides đã training.
- [ ] Cutover timestamp/system-of-record theo domain, freeze window, rollback owner/criteria được phê duyệt.
- [ ] Sau deploy: migration status, `/api/health/live`, `/api/health/ready`, login, permission negative, critical read/write smoke PASS.
- [ ] Evidence lưu trong hệ thống kiểm soát truy cập, không chứa password/token/PII dư thừa.
