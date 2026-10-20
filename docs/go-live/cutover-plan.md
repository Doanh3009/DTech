# Cutover plan template

Khuyến nghị phased: HR/Attendance/Leave → Timesheet → Project/Worker Attendance → Warehouse → XNK → Integrations. Timesheet phụ thuộc attendance/leave/calendar; XNK receiving phụ thuộc Warehouse.

Điền trước cutover: owner từng domain, freeze start/end, source-of-record switch timestamp, full/delta source checksum, backup ID, release SHA, migration batch IDs, communication window và rollback commander.

Trình tự: freeze → final source export → backup → delta dry-run → migration → reconciliation → deploy → smoke → business verification → switch source of record. Nếu rollback, giữ snapshot/delta mọi transaction mới; không sửa opening balance trực tiếp hoặc bỏ business record phát sinh.
