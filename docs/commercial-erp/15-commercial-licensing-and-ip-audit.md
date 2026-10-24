# Dependency và quyền thương mại

Không tìm thấy root LICENSE ở baseline. **BLOCKER: COMMERCIAL IP/CODE RIGHTS NEED OWNER REVIEW.** Không tự gán license cho mã nguồn hoặc suy luận private repository đồng nghĩa có đủ quyền phân phối mọi asset.

Bằng chứng local:

- `evidence/dependency-inventory.json`: 666 package entries từ lockfile và installed metadata; 2 entry chưa có license metadata rõ trong snapshot đầu.
- `evidence/sbom.cdx.json`: CycloneDX do `npm sbom --sbom-format=cyclonedx --omit=dev` tạo. Đây là inventory, không phải legal/security approval.
- `package.json`, `package-lock.json`, local dependency license files và `public/brand`/fonts cần review quyền phân phối thực tế.

Giữ asset Châu Tuấn để tương thích bản cài cũ, không dùng làm fallback cho khách mới. Các khóa browser storage chứa tên cũ là compatibility identifiers; không phải asset marketing.

Cần owner xác nhận chain of ownership, commercial/sublicense rights, logo/font/ảnh và nghĩa vụ attribution. Chưa thực hiện kết luận pháp lý hay audit advisory trực tuyến trong P0.
