# DIMIXO: nghiệp vụ và không gian trải nghiệm

Ngày cập nhật: 23/10/2026. Tên sản phẩm được người dùng xác nhận là **DIMIXO**. Hai tài liệu DOCX Châu Tuấn/MISA là tài liệu tham khảo yêu cầu; không phải lệnh vận hành hoặc quyền truy cập hệ thống.

## Đường vào hệ thống

- `/login` và `/trai-nghiem`: chọn doanh nghiệp, khi control center được bật.
- `/erp/<slug>/login`: tài khoản doanh nghiệp; dữ liệu lấy theo tenant của phiên đăng nhập.
- `/control-center/login`: đội triển khai. Cấu hình doanh nghiệp nằm trong control center.
- ERP nội bộ cũ vẫn giữ tài khoản và dữ liệu hiện có. Tài khoản doanh nghiệp không được dùng các truy vấn toàn cục của ERP nội bộ.

| Doanh nghiệp trải nghiệm | Địa chỉ | Luồng thể hiện khác biệt |
| --- | --- | --- |
| Cơ khí Thành Phát | `co-khi-thanh-phat` | Thép, CNC, công đoạn, giờ công/máy, sản lượng cuối, nhập thành phẩm |
| Bao bì An Phú | `bao-bi-an-phu` | Hạt nhựa, khuôn/lòng khuôn/chu kỳ, định mức, hao hụt, thành phẩm |
| Điện tử Minh Tín | `dien-tu-minh-tin` | PCB/linh kiện, SMT, kiểm thử, liên kết lô đầu vào với thành phẩm |
| Thực phẩm An Nhiên | `thuc-pham-an-nhien` | Mẻ sản xuất, lô, chất lượng, hạn dùng, chặn xuất lô không phù hợp |
| Phân phối Hưng Thịnh | `phan-phoi-hung-thinh` | Hàng gia dụng, đơn mua, nhận hàng từng phần, đơn bán/giao hàng, thu nợ |
| Xây dựng Châu Tuấn | `xay-dung-chau-tuan` | Công trình, ngân sách, cấp vật tư, chi phí nhân công, tiến độ |

Tên người và hoạt động được dựng để mô phỏng vận hành; không phải danh tính hoặc giao dịch thật. Mỗi doanh nghiệp có tài khoản quản lý, tài khoản kế toán để thao tác duyệt bởi người khác, và tài khoản nhân viên chỉ xem. Tổng cộng 18 tài khoản. Mật khẩu chỉ nằm trong `.tmp/DIMIXO-tai-khoan-trai-nghiem.md`, không đưa vào git hoặc trang công khai.

Đội triển khai có thể cấp thêm tài khoản khách ngay trong hồ sơ setup; xem [cấp tài khoản ERP khách hàng](operator-business-accounts.md). Doanh nghiệp mới không phải chờ sửa database để có người duyệt kế toán thứ hai.

## Phạm vi kế toán đang có

Module được đăng ký là **Kế toán**. Lương là một phần hành bên trong module.

| Phần hành | Chứng từ / sổ thực hiện |
| --- | --- |
| Danh mục | Tài khoản chi tiết/tổng hợp, tính chất dư, đối tác |
| Tổng hợp | Chứng từ, chi tiết định khoản, nhật ký chung, sổ cái, cân đối phát sinh |
| Tiền mặt/ngân hàng | Phiếu thu/chi, thu khách hàng, thanh toán nhà cung cấp, kiểm tra số dư khi chi |
| Mua hàng | Đơn mua, dòng hàng, nhận từng phần, hóa đơn mua, phải trả |
| Bán hàng | Đơn bán, giao từng phần, hóa đơn bán, phải thu, thu tiền |
| Lương | Nhân sự, công xác nhận, bảng lương, phụ cấp/khấu trừ nhập rõ số tiền, hạch toán lương |
| Kỳ kế toán | Mở kỳ, chặn kỳ trùng, kiểm tra chứng từ nháp trước khi khóa, chặn ghi/đảo vào kỳ khóa |
| Kiểm soát | Người lập khác người duyệt, không sửa chứng từ ghi sổ, đảo có lý do, audit, row version, request UUID và receipt |

Ngày chứng từ và ngày hạch toán được lưu riêng. Chỉ bút toán `posted` tham gia sổ kế toán. Tổng Nợ phải bằng tổng Có và lớn hơn 0; tài khoản dùng để ghi sổ phải là tài khoản chi tiết đang hoạt động. Sửa chứng từ/dòng định khoản làm mất duyệt trước đó. Bảng lương không được vượt công đã xác nhận, kỳ lương không chồng kỳ đã ghi sổ; giờ/ngày và ngày chuẩn được cấu hình trong bảng lương.

Nhận hàng và hóa đơn là hai chứng từ riêng. Đơn mua là cam kết; xuất vật tư/các chi phí đã ghi nhận là phát sinh quản trị. Không cộng cam kết với phát sinh thành một chi phí. Khi bật kế toán, công nợ bán chỉ phát sinh từ hóa đơn đã ghi sổ. Cấu hình chỉ bán hàng vẫn có công nợ vận hành riêng.

## Các phần chưa được thay bằng tích hợp giả

Hai DOCX mô tả 28 nhóm module và 20 phần hành kế toán, rộng hơn phạm vi đang triển khai. Hệ thống hiện có 41 loại danh mục/chứng từ trong miền tenant; số lượng này không đồng nghĩa hoàn thành toàn bộ DOCX.

- Hóa đơn mua/bán hiện là chứng từ nội bộ. Chưa phát hành hóa đơn điện tử, ký số hoặc gửi cơ quan thuế.
- Chưa tích hợp ngân hàng để tự lấy sao kê/đối soát; phiếu thu chi là chứng từ do người dùng lập.
- Thuế được nhập bằng số tiền và tài khoản thuế; chưa có bộ tờ khai, quyết toán hoặc BCTC theo mẫu pháp định. Không có tỷ lệ pháp lý cố định trong mã nguồn.
- Chi phí sản xuất/công trình là sổ quản trị từ chứng từ nguồn. Kết chuyển giá thành, giá vốn, khấu hao tài sản và phân bổ chi phí trả trước chưa tự động hóa; có thể lập chứng từ tổng hợp. Không suy ra kết quả kinh doanh pháp định từ số quản trị này.
- Chưa có hồ sơ hợp đồng lao động/bảo hiểm đầy đủ trong miền tenant, công thức PIT/BHXH, phân quyền theo từng phần hành hoặc theo từng công trình. Ba vai trò hiện có là quản lý, biên tập và chỉ xem, trong phạm vi toàn doanh nghiệp đã được cấp module.

## Thương hiệu và hiệu năng

- Logo gốc do người dùng cấp được lưu nguyên bản ở `public/brand/dimixo-original.png`. Component dùng `next/image` và CSS để hiển thị biểu tượng; không sửa chữ trong ảnh.
- Nền trang có hai lớp chuyển động bằng CSS transform, có nút dừng và tôn trọng reduced motion. Bảng/form vẫn dùng bề mặt trắng và token chung.
- Tắt prefetch đồng loạt của gateway và menu doanh nghiệp. Thẻ ERP nội bộ chỉ prefetch khi có ý định truy cập.
- Heartbeat phiên ERP nội bộ được giới hạn tối đa một lần/phút; kiểm tra tài khoản, phiên và quyền vẫn diễn ra.
- Có loading boundary riêng cho workspace. Bản phục vụ tại localhost dùng build tối ưu để tránh biên dịch trang khi thao tác.

Lượt quan sát Edge trên bản build tối ưu: đăng nhập sáu doanh nghiệp, mở các module và chi tiết định khoản, bố cục 390/768/1440px; không gặp lỗi JavaScript hoặc API trong lượt này. Sáu lần điều hướng tới Kế toán tới lúc API trả dữ liệu trong lượt gần nhất mất 535–602 ms. Đây là số đo trên máy hiện tại, không phải cam kết thời gian cho mọi mạng hoặc mọi thao tác.

Ngày 24/10, màn cấp tài khoản trong control center đã được mở bằng tài khoản đội triển khai hiện có, tải đủ ba tài khoản của doanh nghiệp ở 1440/390px. Tài khoản nhân viên chỉ xem đã đăng nhập và mở kế toán/chứng từ; giao diện không có hành động tạo chứng từ. Không có lỗi API hoặc JavaScript trong lượt quan sát này. Luồng cấp mới đã tạo sáu tài khoản chỉ xem trong bộ dữ liệu trải nghiệm; cấp lại mật khẩu/tạm ngừng/mở lại chưa được thực hiện trên tài khoản đang dùng để tránh thay đổi phiên của người dùng.

Typecheck, ESLint và build được thực hiện. Không chạy bộ unit/integration/E2E test trong lượt làm việc này.

## Nguồn đối chiếu

- `Tong_hop_nghiep_vu_MISA_BRD_SRS_ERP_Chau_Tuan_ban_mo_rong.docx` và `De_cuong_dac_ta_nghiep_vu_ERP_tham_chieu_MISA_Chau_Tuan.docx`, người dùng cung cấp ngày 23/10/2026.
- [MISA SME 2026: Khóa sổ kế toán](https://helpsme.misa.vn/2026/kb/khoa_so_ke_toan/).
- [MISA SME 2026: Mua hàng](https://helpsme.misa.vn/2026/kb/3-mua-hang/).
- [MISA: Ghi sổ/Bỏ ghi sổ](https://helpsme2021.misa.vn/2026/kb/ghi_so_bo_ghi_so/).

Các nguồn được dùng để đối chiếu luồng và điểm kiểm soát; không sao chép giao diện, thương hiệu hoặc tuyên bố đạt chứng nhận pháp lý của MISA.
