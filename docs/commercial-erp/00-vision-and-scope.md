# DTech Commercial ERP — phạm vi

Ngày: 21/10/2026. Baseline: `3db5b84c6fee4d70433c7efea91e3fedea340f9d`, nhánh làm việc `feature/commercial-erp-p0-audit`. Working tree đã có thay đổi trước đợt P0; chưa tạo commit hoặc PR.

Nguồn yêu cầu: trao đổi trực tiếp và tài liệu `DTECH_ERP_COMMERCIAL_MASTER_PROMPT.md` do chủ dự án cung cấp. Tài liệu là đặc tả dự án; yêu cầu trực tiếp mới nhất được ưu tiên khi khác ví dụ trong tài liệu.

## Quyết định phạm vi

- Một mã nguồn; mỗi khách hàng có deployment, Supabase Auth/DB/Storage và secret riêng.
- Đăng nhập không liệt kê module; sau đăng nhập vào `/applications`.
- Không có module Dashboard độc lập; bỏ bộ lọc nhóm trên App Center. Giữ các service/read model báo cáo hiện có để tái sử dụng trong domain.
- Không xóa lịch sử, dữ liệu hay luồng nghiệp vụ để trung lập hóa thương hiệu.
- Đợt hiện tại: P0 và sửa nền tảng có phạm vi nhỏ. P2P/O2C/GL/sản xuất chưa được triển khai chỉ bằng việc thêm menu.

Đích thương mại cần UAT, môi trường triển khai, backup/restore, license/IP và vận hành thực tế. Local build/test không thay thế các bằng chứng đó.
