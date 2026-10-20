# Kết quả PROMPT 01 — Gói / Công trường

Ngày kiểm tra: 25/09/2026  
Phạm vi: `/projects`, `/projects/[id]/progress` và kiểm tra hồi quy các tab gói. Dashboard không được thiết kế lại trong bước này.

## A. Mã nguồn đã thay đổi

- `src/app/(app)/projects/page.tsx`: truyền quyền `project.create` từ server vào danh sách gói.
- `src/features/projects/components/ProjectPortfolioWorkspace.tsx`: thay composition danh sách; thêm dải tổng quan, tìm/lọc và row desktop/card mobile dùng cùng dữ liệu.
- `src/features/projects/components/ProjectPortfolioWorkspace.module.css`: style cục bộ cho danh sách, không thêm override vào global CSS.
- `src/features/projects/components/package-workspace/PackageConstructionWorkspace.tsx`: thay composition tab Thi công; nhóm công việc theo trạng thái, panel Cần quan tâm và tóm tắt lượt công.
- `src/features/projects/components/package-workspace/PackageWorkspace.module.css`: layout desktop/mobile cho tab Thi công; bỏ nhu cầu CTA sticky ở màn này.
- `src/features/projects/components/package-workspace/PackageContextHeader.tsx`: diễn giải đúng `% khối lượng`.
- `src/features/projects/components/package-workspace/projectProgressSelectors.ts`: selector dùng chung cho tổng quan, lọc giữ cây cha-con và nhóm trạng thái.
- `src/features/projects/components/package-workspace/projectProgressSelectors.test.ts`: test trường hợp 100% khối lượng nhưng vẫn vướng/đang làm và tìm kiếm node con.
- `scripts/package-workspace-qa.mjs`: QA browser thật ở 390×844 và 1440×900.

## B. Root cause và thay đổi nhìn thấy

| Root cause đã xác minh | Kết quả |
|---|---|
| Tổng phần trăm của root task được ghi là “hoàn thành”, dù status vẫn `blocked`/`in_progress` | Đổi thành “100% khối lượng”; trạng thái mở vẫn hiện riêng |
| Tab Thi công render toàn bộ 7 dòng lịch/chấm công cạnh task | Chỉ còn “Lượt công 7 ngày: 21” và link sang tab Chấm công |
| Task hiển thị một bảng phẳng, ưu tiên theo thứ tự dữ liệu | Nhóm `blocked → in_progress → not_started → completed → cancelled`; hoàn thành/đã hủy mặc định thu gọn |
| Mobile dùng lại hàng desktop nên tên bị cắt và CTA sticky có nguy cơ che nội dung | Task card mobile, tên tối đa hai dòng, target ≥44px, filter sheet và CTA inline theo quyền |
| Danh sách gói phụ thuộc global class và luôn hiện Tạo gói | CSS module riêng; row desktop/card mobile; action theo `project.create` |
| Giá trị `all` bị FilterBar tính là một bộ lọc đang bật | Hai màn dùng giá trị rỗng cho lựa chọn “Tất cả”, nên mobile không báo bộ lọc giả |

Mapping trạng thái dùng đúng enum hiện có: `blocked=Cần xử lý`, `in_progress=Đang thực hiện`, `not_started=Chưa triển khai`, `completed=Hoàn thành`, `cancelled=Đã hủy`.

## C. Bằng chứng browser thật

| Màn | Before | After |
|---|---|---|
| Danh sách desktop | `docs/ui-evidence/two-screen-audit/before-projects-list-1440x900.png` | `docs/ui-evidence/two-screen-audit/after-projects-list-1440x900.png` |
| Danh sách mobile | `docs/ui-evidence/two-screen-audit/before-projects-list-390x844.png` | `docs/ui-evidence/two-screen-audit/after-projects-list-390x844.png` |
| Thi công desktop | `docs/ui-evidence/two-screen-audit/before-project-progress-full-1440x900.png` | `docs/ui-evidence/two-screen-audit/after-project-progress-1440x900.png` |
| Thi công mobile | `docs/ui-evidence/two-screen-audit/before-project-progress-full-390x844.png` | `docs/ui-evidence/two-screen-audit/after-project-progress-390x844.png` |

Browser QA xác nhận không tràn ngang, đủ bốn tab, drawer Thông tin gói mở được, và các route Chấm công/Hồ sơ/Tài liệu vẫn render ở cả hai viewport.

## D. Test matrix

| Kiểm tra | Kết quả |
|---|---|
| Đăng nhập `test.supervisor` → Dashboard | PASS |
| Project browser QA 1440×900 | PASS |
| Project browser QA 390×844 | PASS |
| Selector unit test | PASS — 2/2 |
| Full test suite | PASS — 68 files, 231 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; build có log `system_settings.read_failed` từ môi trường nhưng exit code 0 |
| Dashboard regression/performance | PASS — feedback đầu 940 ms, content 3287 ms, không client fetch dashboard |
| Kho bằng tài khoản QA hiện tại | BLOCKED — tài khoản không có quyền route Kho; source/CSS Kho không bị sửa |
| Mutation task bằng role có quyền cập nhật | BLOCKED — tài khoản browser QA là role chỉ xem trong snapshot này |

## E. Hành vi giữ nguyên và giới hạn dữ liệu

- Giữ nguyên API tiến độ, mutation thêm/sửa/cập nhật nhanh, drawer cập nhật hiện trường, realtime/refetch, deep-link query và kiểm tra permission hiện có.
- Chấm công, Hồ sơ và Tài liệu không đổi nghiệp vụ; chỉ được smoke-test hồi quy.
- API hiện tại không cung cấp lý do vướng hoặc bản cập nhật mới nhất trong payload progress, nên panel Cần quan tâm chỉ hiển thị status, deadline và phần trăm thật; không tạo dữ liệu giả.
- Backend hiện tại không có lệnh xóa task trong component cũ, nên không tự thêm mutation xóa.
- Danh sách nhiều task dùng row compact và hiện tổng số; pagination/virtualization chưa có API hỗ trợ, cần kiểm tra riêng ở PROMPT 03 với seed 20/100 task.

Dừng tại PROMPT 01; chưa thay đổi composition Dashboard theo PROMPT 02.
