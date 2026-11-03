> Cập nhật 03/11/2026: đã deploy commit `e6cb821` lên [DIMIXO ERP](https://dimixo-erp.vercel.app), Supabase phát triển 161 migration. Chứng từ, phân quyền nhạy cảm và bốn dịch vụ mô phỏng đã qua SQL thực và trình duyệt; 18 tài khoản đã kiểm chứng trên Vercel. Đây là đợt hoàn thiện trong 82 mục, không phải nghiệm thu toàn bộ. Xem [biên bản mới](../commercial-erp/misa-document-workspace.md) và [việc còn mở](misa-launch-worklist.md).

﻿# Tiến độ triển khai nghiệp vụ tham chiếu MISA

Nhập CSV/XLSX cho vật tư/đối tác/kho đã phát hành ở commit `3dfac27`, database 151 migration. Có xem trước, đối chiếu giá trị, chọn dòng và receipt thử lại. [Hướng dẫn](catalog-import.md), [bằng chứng](../commercial-erp/evidence/misa-catalog-import-release.json). Nghiệm thu đầy đủ 82 yêu cầu vẫn mở.

Bản cập nhật UI/nghiệp vụ đã deploy Vercel ngày 02/11/2026, commit `c847c8b`; xem [biên bản phát hành](../commercial-erp/evidence/misa-vercel-release-20261102.json). Phần nghiệm thu đầy đủ 82 yêu cầu và các phụ thuộc còn mở không được đánh dấu hoàn tất từ kết quả phát hành.

Ngày cập nhật: 02/11/2026. Hai DOCX là nguồn yêu cầu tham khảo. Bảng này ghi phần triển khai hiện có, không thay thế nghiệm thu và không xác nhận hệ thống tuân thủ toàn bộ chế độ kế toán/thuế.

## Trạng thái môi trường

- Cập nhật 02/11/2026: toàn bộ migration đến `202611020013` đã áp dụng trên project phát triển; tổng 150 migration, 142 thực thể business. Các ghi chú local/chưa áp dụng của các đợt cũ phía dưới được thay thế bởi [bản cập nhật phát hành](misa-release-20261102.md), [rollout](../commercial-erp/evidence/misa-feature-rollout.json) và [readiness](../commercial-erp/evidence/misa-release-readiness.json). Bản ứng dụng mới đang được đóng gói phát hành; ma trận 82 yêu cầu vẫn chưa nghiệm thu toàn bộ.
- Ngày 02/11/2026, sau khi người dùng cho phép cả 18 tài khoản, đã kiểm chứng đủ sáu owner, sáu editor và sáu viewer trên bản Vercel hiện có: đăng nhập, đúng tenant/vai trò, đăng xuất đều HTTP 200. Tệp bàn giao mật khẩu được cập nhật riêng trong `.tmp` bị Git bỏ qua; [bằng chứng không chứa thông tin đăng nhập](../commercial-erp/evidence/misa-account-verification.json). Đây là kiểm tra xác thực, chưa phải nghiệm thu nghiệp vụ/trình duyệt.
- Mã nguồn: 142 thực thể nghiệp vụ; có dữ liệu mô phỏng cho sáu ngành.
- Migration `202610240005`–`202610240038` đã áp dụng trên Supabase phát triển `tcjjhxqtreemccdbvyza` sau khi người dùng xác nhận quyền cập nhật.
- Ngày 26/10/2026, sau khi người dùng cho phép, đã áp dụng `202610260001`–`202610260003` lên cùng project phát triển. Sau rollout có 118 migration; số tenant/tài khoản/session/command giữ nguyên `6/18/93/5358`; sáu bảng mới bật RLS, không cấp quyền bảng trực tiếp, RPC chỉ execute bởi `service_role`. Không tạo policy, form, lượt duyệt hay dữ liệu chứng từ mẫu. [Bằng chứng rollout C04](../commercial-erp/evidence/misa-approval-rollout.json).
- Đã nạp dữ liệu bổ sung tài chính, vận hành, chấm công và CRM bằng các command nghiệp vụ. Không nạp lại seed tạo tenant.
- Đích Vercel: project riêng `dimixo-erp`, dùng database phát triển; tình trạng phát hành ghi tại bằng chứng triển khai. Project ERP nội bộ hiện tại không được đổi database.
- Bản hiện tại đã phát hành tại [DIMIXO ERP](https://dimixo-erp.vercel.app), dùng Next.js và vùng xử lý Singapore. Trang giới thiệu, đăng nhập, chọn doanh nghiệp và readiness database đã đối chiếu qua HTTP; đây không phải nghiệm thu toàn bộ nghiệp vụ MISA.
- Dữ liệu ERP nội bộ và hai project được bảo vệ không thuộc phạm vi cập nhật.

## Phần đã triển khai local

| Nhóm | Nghiệp vụ và kiểm soát đã có | Phần còn thiếu / giới hạn |
| --- | --- | --- |
| C02 | Danh mục quy đổi đơn vị vật tư theo ngày; công cụ tính thử; hệ số cũ bất biến sau ngày hiệu lực; cấm kỳ chồng nhau, đơn vị cơ sở trống và đổi đơn vị cơ sở khi đã có tham chiếu; số lượng sê-ri nguyên | E2E PostgreSQL và API có mock đã qua. Còn Excel/xử lý xung đột từng dòng, alias/gộp trùng và snapshot đơn vị/hệ số trên phiếu kho/mua/sản xuất. Chưa nghiệm thu tài khoản/trình duyệt thật. |
| C01–C03 | Session suy ra tenant; chủ doanh nghiệp cấp/khóa/mở/cấp lại tài khoản; liên kết nhân viên; hạn truy cập và hạn quyền chi tiết; tự khóa tài khoản liên kết khi ngừng hồ sơ nhân viên; thu hồi session; chuyển chủ sở hữu có CAS, xác nhận, điều kiện tài khoản đích và nhật ký; mẫu quyền xem/nhập/duyệt; báo cáo tách chứng từ; phạm vi người tạo/công trình/phòng ban; nhật ký xem được trong ERP; CAS và request UUID | Migration `202610260010` cho chuyển chủ sở hữu đang local, chưa áp dụng/phát hành. Còn thiếu danh mục tổ chức/chức danh có lịch sử, mời qua email và ủy quyền theo hiệu lực |
| S01–S04 | Chiến dịch/kênh/chi phí; chống trùng email/điện thoại lead; ghi consent; đánh giá đủ điều kiện; chuyển lead thành khách/cơ hội có liên kết nguồn; owner và xác suất; báo giá phiên bản/chiết khấu/hiệu lực; phản hồi khách; hợp đồng lấy giá đã chấp nhận; phụ lục; đặt hàng từng đợt có giới hạn còn lại; ticket/phản hồi/giải quyết/đóng/mở lại/chuyển cấp; pipeline, chi phí/lead và SLA từ chứng từ | PostgreSQL tổng hợp xác nhận trên sáu tenant: lead → khách hàng có sẵn/cơ hội thắng; báo giá được chấp nhận → hợp đồng đúng nguồn → phụ lục 100→120 → đặt 50, còn 70; đặt thêm 71 bị từ chối; ticket đúng SLA đóng và ticket trễ escalated. Tenant xây dựng có công trình liên kết bất biến với hợp đồng nguồn. Chưa nối form/kênh marketing bên ngoài, gửi email tự động, lịch hẹn/cộng tác, merge lead, nhiều phiên bản báo giá, bảo hành, WBS/ngân sách/task từ chính hợp đồng này và đầy đủ điều khoản thanh toán. Giá trước thuế; VAT ghi ở hóa đơn. Chưa browser acceptance hoặc tài khoản thật. |
| C04 | Chứng từ dùng chính sách duyệt nhiều bước theo phiên bản, nhóm duyệt tất cả/một người, hạn xử lý, ủy quyền có thời hạn; ghi quyết định/lý do, trả lại/từ chối/thu hồi; dấu vân tay phát hiện dữ liệu đổi; biểu mẫu bổ sung có phiên bản, điều kiện hiển thị/bắt buộc, giá trị mặc định, mẫu kiểm tra, quyền đọc/ghi theo vai trò và che bốn ký tự ở trường chỉ đọc; xác thực biểu mẫu ở RPC theo tenant; hộp thư duyệt lọc theo người được giao, quyền và bước hiện tại; có thể cấu hình người thay thế tự nhận bước khi hết SLA; tệp đính kèm riêng tư chỉ thêm, xác thực MIME/chữ ký tệp, lưu SHA-256 và đưa vào dấu vân tay duyệt; báo cáo tồn đọng, quá SLA, số lần trả về và thời gian xử lý trung bình 30 ngày | Migrations `202610260001`–`202610260003` đã áp dụng trên Supabase. Hộp thư, chuyển cấp, điều kiện/default/pattern, quyền/masking, báo cáo và tệp đính kèm đang ở local trong migrations `202610260004`–`202610260009`, chưa áp dụng và chưa phát hành ứng dụng. Còn thiếu chữ ký số, ánh xạ API và lịch sử chuyển dữ liệu giữa phiên bản biểu mẫu. Chưa nghiệm thu quyền, tải lớn, antivirus và từng luồng chứng từ |
| C07 | Dashboard theo ngành, sổ kế toán, bảng đối chiếu và tìm kiếm toàn cục tenant-scoped, lọc theo feature/quyền từng dòng; CSV tối đa 5.000 dòng có chống công thức và kiểm tra dữ liệu lặp/thiếu giữa các trang | 29 kiểm tra export/API/component có mock đã qua; chưa nghiệm thu tài khoản/trình duyệt thật. Còn dashboard theo vai trò, pivot tự cấu hình, lịch chạy, XLSX/PDF, lịch sử xuất và tìm kiếm toàn văn. |
| F01 | Thu/chi, tiền mặt/ngân hàng, tạm ứng–quyết toán–hoàn quỹ, khế ước–giải ngân–trả gốc/lãi thực tế, đối chiếu từng phần sao kê; kiểm tra số dư tại ngày và số dư tương lai | Đề nghị thanh toán đã có nguồn chứng từ duy nhất và duyệt hai người; chưa kết nối ngân hàng thật, chưa có hạn mức chi trả và kiểm tra số dư tương lai đầy đủ |
| F02 | Bút toán kép; kỳ kế toán; duyệt khác người lập; bút toán đã ghi sổ không sửa trực tiếp; đảo có phụ thuộc; công nợ, thu/chi, hóa đơn; điều chỉnh giảm và hoàn tiền; kết chuyển; báo cáo cấu hình từ sổ cái | Chưa nghiệm thu đủ mẫu báo cáo theo chế độ kế toán; đối chiếu hóa đơn theo từng dòng nhận hàng, GRNI và xử lý chênh giá đến sau còn thiếu |
| O06 / tài sản | Ghi tăng tham chiếu chứng từ hình thành; kiểm soát phần nguyên giá chưa dùng; tài sản/CCDC/trả trước; phân bổ theo ngày, bàn giao/thu hồi, bảo dưỡng, ghi giảm; đảo theo thứ tự phụ thuộc | Còn thiếu kiểm kê tài sản nhiều đợt, nâng cấp/đánh giá lại, sửa chữa lớn và thanh lý đầy đủ các trường hợp |
| O07 / chất lượng và an toàn | Sự cố an toàn, điểm không phù hợp, CAPA liên kết nguồn; duyệt hai người và xác nhận hiệu lực độc lập. Dashboard tenant-scoped có số sự cố, dừng công việc, mức độ, CAPA quá hạn và xu hướng 12 tháng. | PostgreSQL E2E đã pass từ incident đến CAPA xác minh độc lập, mức độ, chuỗi 12 tháng và quyền từng dòng. Bản tổng hợp local có 90 migration, 142 thực thể. Còn báo cáo tuân thủ pháp lý, retention và browser acceptance bằng tài khoản thật. |
| F03 | Tập hợp vật tư theo giá bình quân thực tế, nguồn chi phí đã ghi sổ, phân bổ lương và chi phí chung; dở dang; hoàn thành một phần; giá thành theo lần nhập; giá xuất và giá vốn; chặn sửa nguồn đã tiêu thụ | Còn thiếu đầy đủ phương pháp hệ số/tỷ lệ/phân bước, dự toán theo mã chi phí và xử lý chi phí/giá hóa đơn đến sau |
| O03 | Đề nghị mua, các dòng nhu cầu, nhiều báo giá, so sánh báo giá đủ phạm vi, chọn từng phần, sinh đơn mua/dòng có nguồn; nhận một phần; kiểm soát số lượng đã đặt xuyên nhiều báo giá | Chưa đầy đủ RFQ gửi nhận, trả hàng mua, thuế/phí mua phân bổ, quy đổi đơn vị và đối chiếu hóa đơn theo dòng |
| O04 | Ledger kho, lô/serial/chất lượng; điều chuyển có hai vế; kiểm kê có khóa kho, chênh lệch và định khoản; hoàn trả vật tư về phiếu xuất gốc; chặn âm tồn theo ngày và các ngày sau | Còn thiếu giữ hàng/vị trí kho, kiểm kê nhiều tổ, UOM có lịch sử quy đổi và các trường hợp nhập/xuất đặc biệt |
| O01 | WBS, ngân sách theo phiên bản/lý do, hạn mức bổ sung; điều chỉnh khối lượng hợp đồng; nghiệm thu không vượt khối lượng; đối chiếu nghiệm thu–hóa đơn; tạm dừng/tiếp tục/khóa công trình | Hạn mức hiện kiểm soát ở tổng công trình; chưa đầy đủ theo WBS/khoản mục, hợp đồng chủ đầu tư, bảo hành/giữ lại, quyết toán và giao việc |
| O01 | Công trình, WBS, dự toán có phiên bản, biến động, nghiệm thu và vòng đời | PostgreSQL tổng hợp trên tenant xây dựng pass: revision 1→2, snapshot baseline cũ giữ nguyên, ngân sách hiện hành phản ánh revision mới; thử workflow có WBS, variation, acceptance, pause/resume. Chưa nghiệm thu milestone, liên kết hợp đồng, quyết toán đóng công trình hoặc tài khoản thật. |
| O02 | Giao task theo cong trinh, nguoi phu trach, WBS, han, uu tien, trang thai, tien do; checklist bat buoc; predecessor; task/subtask; approval nghiem thu theo quyen; lich/critical path; binh luan, nhat ky ca va tep dinh kem | Migrations `202610260011-014` va UI/API dang local. PostgreSQL tong hop pass 83 migrations/138 entities; runtime pass checklist, predecessor, dependency/hierarchy cycle, task acceptance, stale version, tenant scope/isolation, idempotency va nhat ky ca. Typecheck pass. Chua apply migration; attachment storage va browser acceptance chua kiem tra. |
| O03 | De nghi mua → duyet → bao gia NCC → chon nha cung cap → nhieu PO → nhan mot phan | Entity/approval/calculation tai migrations `202610240023-024`; PostgreSQL tong hop pass 6 bo du lieu nganh: PR 100, awards 60+40, nhan mot phan 30 va tu choi dat 120. Chua nghiem thu tai khoan doanh nghiep that, payment/bank reconciliation hoac cloud rollout. |
| O04 | Nhap, xuat, dieu chuyen, kiem ke, ton theo ledger va lot; khong am ton duoi dong thoi | PostgreSQL tong hop pass 83 migrations/138 entities; generator chay transfer/count tren 6 bo du lieu nganh. Hai phieu xuat dong thoi, moi phieu 627 tren ton 1045, chi mot phieu ghi ledger; phieu con lai bi tu choi `BUSINESS_INSUFFICIENT_STOCK`. Chua nghiem thu lot/serial, khoa kiem ke va browser tai khoan that. |
| H02 | Hồ sơ nhân viên và quan hệ lao động | Hợp đồng, lịch sử biến động và giấy tờ có tenant scope, duyệt hai người, che lương/số giấy tờ theo vai trò; khóa mã nhân viên và chặn hợp đồng chồng lấn/sửa trực tiếp. PostgreSQL tổng hợp pass 83 migrations/138 entities; workspace báo cáo giấy tờ và hợp đồng hết hạn/sắp hết hạn tenant-scoped. Còn thiếu hiệu lực tương lai/tính lại payroll lịch sử, nhắc hạn tự động, tái tuyển dụng và quyết toán nghỉ việc; chưa rà quyền nhạy cảm trên toàn bộ báo cáo và chưa nghiệm thu browser bằng tài khoản thật. |
| H03 | Ca ngày/đêm, phân ca, nghỉ phép, OT, bảng công và khóa kỳ | PostgreSQL tổng hợp pass trên 6 tenant giả lập: ca 20:00–05:00 tạo đúng 1 thẻ công ngày 18/10 với 8 giờ thường, 0 giờ OT; nghỉ phép trả lương 8 giờ; OT chưa duyệt và xác nhận sau khóa công đều bị từ chối. Chưa nghiệm thu QR/thiết bị, chia giờ nhiều công trình, giải trình quên chấm công, payroll và browser tài khoản thật. |
| H04 | Tính lương, khấu trừ, chi trả và phân bổ lao động | PostgreSQL tổng hợp pass trên sáu tenant giả lập: tổng gross = net + khấu trừ, bút toán lương cân, chi trả không vượt thực lĩnh và phân bổ chi phí đã ghi sổ đủ 100% cho dòng được phân bổ. Chưa xác nhận công thức/thuế với kế toán, tính lại có phiên bản, điều chỉnh kỳ đã khóa, bảo mật phiếu lương hoặc thanh toán ngân hàng thật. |
| H03 | Ca ngày/đêm với ngày công cấu hình; phân ca và chặn trùng; nghỉ hưởng/không hưởng lương; hạn mức phép; OT được duyệt; xác nhận ca tạo một phiếu công; khóa kỳ; nguồn công đã vào lương không tự sửa | Chưa kết nối thiết bị/QR/check-in; lịch thay đổi tổ chức và phân công chưa đầy đủ |
| H04–H05 | Công thường và phép hưởng lương vào điều kiện tính lương; thuế/đóng góp theo hồ sơ, chính sách có hiệu lực và bậc cấu hình; phân bổ chi phí lương; khấu trừ riêng, khoản doanh nghiệp chịu; chi trả từng nhân viên, số dư lương phải trả và chặn chi vượt/đảo bảng lương đã chi | Chưa đầy đủ cơ cấu thu nhập theo hợp đồng/phiên bản, các khoản lương phức tạp và hồ sơ BHXH/thuế gửi thực tế. Hệ số và thuế suất trong demo chỉ là cấu hình minh họa |

| H01 | Nhu cầu và tin tuyển dụng; ứng viên có consent và dữ liệu HR-only; vòng sơ loại/phỏng vấn; dải offer; tiếp nhận sang hồ sơ nhân viên, chặn ứng viên/hire trùng | PostgreSQL tổng hợp pass luồng đến bàn giao hồ sơ nhân viên trên tenant giả lập; evidence ghi tại `industry-schema-build.json`. Chưa tích hợp kênh/lịch, lưu giữ CV/consent, báo cáo tuyển dụng và chuỗi hợp đồng–HSE–công trình–chấm công. |

| H06 | Chu kỳ mục tiêu; mục tiêu cha/con; check-in; thay đổi target có duyệt và lịch sử; trọng số 100%; đánh giá quản lý độc lập; hiệu chuẩn; xác nhận nhân viên; đóng kỳ và snapshot | PostgreSQL tổng hợp pass E2E: mục tiêu 60/40 cho điểm KPI 94; chỉnh target 10→20 giữ lịch sử/người duyệt; điểm chốt 94; từ chối bộ trọng số 99%; khóa sau chốt. Chưa nối nguồn số thực dự án/sản xuất/chấm công hoặc báo cáo theo phòng ban. |

| C05 / C04 / F04 | Yêu cầu ký hai người duyệt; chốt phiên bản và SHA-256 tệp nguồn; outbox tenant-scoped; retry; callback đã xác thực ở adapter service-role; tệp ký là attachment riêng, lưu hash; callback lặp được khử trùng | Migration `202611020001` và E2E PostgreSQL local pass. Chưa có adapter/credentials cho nhà cung cấp, HMAC/chứng thư thật, template merge, xác thực nội dung chữ ký hay lưu trữ hồ sơ ký hợp pháp. |

### Cách đọc ngân sách

`Giá trị đặt mua theo ngân sách` giữ toàn bộ giá trị PO đã phát hành/hoàn thành, gồm cả phần đã thực hiện và phần còn cam kết. Chi phí nguồn khác được tập hợp từ các nguồn đã đối chiếu, phân bổ lương/chi phí chung và vật tư chưa gắn dòng mua. Khi vật tư được gắn đúng dòng mua của công trình, không cộng lại phần đó vào chi phí nguồn khác. Đây là mức sử dụng ngân sách; không phải số dư tiền hoặc toàn bộ giá vốn tài chính của công trình.

### Dữ liệu trải nghiệm

- Sáu công ty dùng cùng cấu hình nghiệp vụ theo ngành và được tách bằng `tenant_id`.
- Mỗi ngành có đề nghị 100 đơn vị, hai báo giá, lựa chọn 60 + 40 và một lần nhận 30; các đơn vị và mặt hàng lấy theo ngành, không cộng số lượng khác đơn vị thành KPI tổng.
- Có điều chuyển, kiểm kê thiếu một đơn vị và định khoản chênh lệch.
- Công ty xây dựng có hai phiên bản ngân sách, hạn mức bổ sung, điều chỉnh khối lượng, nghiệm thu một phần, đối chiếu hóa đơn, tạm dừng/tiếp tục và hoàn trả vật tư.
- Ca đêm 18–19/10 tạo đúng ngày công 18/10 theo chính sách mẫu: 8 giờ thường và 2 giờ tăng ca; có 8 giờ phép hưởng lương ngày 17/10 và kỳ công đã khóa. Giờ công và phép được đưa vào nguồn lương mẫu.
- Kỳ tính giá kho mẫu kết thúc 23/10 để ngày hiện tại 24/10 còn mở cho thao tác mới.
- Mỗi công ty có một chiến dịch, hai lead, một chuyển đổi có nguồn, báo giá được chấp nhận, hợp đồng và phụ lục tăng 100 lên 120 đơn vị; hai đợt đặt 30 và 20, còn được đặt 70. Có một cơ hội mở quá lịch chăm sóc và hai ticket: một đóng đúng hạn, một quá hạn đã chuyển cấp.
- Tên người và hoạt động là dữ liệu mô phỏng, không phải giao dịch hay kết quả khách hàng thật. Tài khoản/mật khẩu chỉ lưu trong tệp bàn giao riêng ở `.tmp`, không đưa vào source công khai.

## Những nhóm chưa hoàn tất

C02 còn Excel/xung đột từng dòng, alias/gộp trùng và quy đổi trực tiếp trên chứng từ. C05–C06 còn phân cấp kho văn bản, lưu trữ, reminder worker và bài đăng/bình luận/subscription; lịch họp tháng/tuần và inbox thông báo đã có local; signing request/outbox/callback có schema local nhưng chưa tích hợp xác thực chữ ký nhà cung cấp. Còn phần tích hợp/kênh/bảo hành của S01–S04; O02 giao việc/đội/tiến độ; O07 báo cáo tuân thủ pháp lý và retention; H01 tích hợp kênh, hồ sơ/CV và báo cáo tuyển dụng; H06 tích hợp nguồn dữ liệu KPI và báo cáo phòng ban; các giới hạn C04, tài chính, xuất/in nêu trong bảng trên.

F04 và phần nộp hồ sơ H05 cần nhà cung cấp/môi trường xác định. Chưa có thông tin nhà cung cấp hóa đơn điện tử, chữ ký số, ngân hàng, BHXH. Không chuyển hồ sơ thành “được tiếp nhận” từ thao tác gửi nội bộ.

Ma trận 82 mục tại [misa-coverage.md](misa-coverage.md) và [misa-requirements.json](misa-requirements.json) vẫn giữ trạng thái đang triển khai. Không dùng số lượng bảng, form hoặc dữ liệu mẫu làm chứng cứ hoàn tất toàn bộ yêu cầu.

## Biên dịch và dữ liệu local

Nguồn thực thi: [compile-business-schema.mjs](../../scripts/commercial/compile-business-schema.mjs). Công cụ cần bộ PostgreSQL Windows và `pg` trong `.tmp/erp-postgres`; chỉ kết nối cluster tạm `127.0.0.1`, dừng cluster sau khi chạy và dọn đúng thư mục do lần chạy đó tạo. Có thể giữ cluster bằng `--keep-local-data` để điều tra.

```powershell
node scripts/commercial/compile-business-schema.mjs --populate-experience --populate-operations --populate-attendance --populate-misa --populate-crm
node scripts/commercial/compile-business-schema.mjs --populate-experience --replay-misa --replay-crm
npm run typecheck
```

Lệnh đầu xuất `.tmp/misa-business-development.sql` và `.tmp/misa-crm-development.sql`; lệnh sau nạp chính các tệp bổ sung đó lên cluster tạm mới. Không áp dụng lại lên cloud đã có các hồ sơ này; guard transaction sẽ từ chối để bảo toàn chứng từ. Không áp dụng lại tệp seed gốc chứa sáu tenant lên cloud đã có dữ liệu. Không dùng tệp finance-only cũ để triển khai riêng vì dữ liệu hiện đã liên kết với kho, công trình và chấm công.

Chứng cứ biên dịch/schema: [industry-schema-build.json](../commercial-erp/evidence/industry-schema-build.json). Bộ kiểm tra chọn lọc có 35 test đã qua: 15 CSV/phân trang, 10 API export, 4 component tải tệp và 6 API quy đổi. API/component dùng mock session/RPC/fetch; đây chưa phải trình duyệt với tài khoản thật hay toàn bộ suite MISA. [Bằng chứng kiểm tra ứng dụng](../commercial-erp/evidence/misa-read-export-checks.json).


### C06 / 2.06 - Meeting calendar and notifications (in progress)

- Added the meeting-room, meeting, and attendee registries and enabled the feature for industry packs. Migration `202611020004_business_meetings_notifications.sql` creates tenant-scoped tables, denies direct table access, and checks room overlaps using IANA time zones.
- Invitations create idempotent notifications for active accounts linked to staff records. The inbox returns minimal metadata to the recipient and supports mark-as-read.
- `node scripts/commercial/compile-business-schema.mjs` compiled 90 business migrations / 142 entities. Synthetic PostgreSQL E2E passed month/week queries, row-scope filtering, six-week bound, room-overlap rejection, invitee-only notification, minimal payload, cross-account isolation and mark-read. No browser acceptance or cloud access was used.
- Calendar UI has month/week modes and opens filtered meeting lists. Reminder worker, email/push, posts/comments/subscriptions, approval-pending state, and direct meeting detail links remain incomplete. Requirement 2.06 remains `in_progress`.


### C07 / 2.07 - Global search (partial)

- Added server search for record code/name. Tenant session, enabled feature, active row state, and per-row access are checked before results are returned. Result payload contains minimal fields and is capped at 50.
- Schema compilation: 90 business migrations / 142 entities; TypeScript check and tenant/custom-scope search E2E passed, including collaboration and safety/quality verifications.
- CSV export uses fixed columns, formula escaping, a 5,000-row cap and pagination consistency guards. Export-related checks passed 15 serialization/pagination, 10 mocked API and 4 jsdom component tests, including failed downloads, retry, cancellation and URL cleanup. Deployed/browser acceptance, custom dashboards, pivots, export history and full-text search remain open. Requirement 2.07 remains `in_progress`.

### O07 / 2.18 - Safety, quality and corrective action (partial)

- Added synthetic acceptance for critical incident capture, two-person approval, source validation, incident posting, linked CAPA completion, independent effectiveness verification, and two-person CAPA approval.
- Fixed approval routing so a non-MISA incident does not require an accounting posting date; preserved MISA calculation and posting flows.
- Full local PostgreSQL compilation passed with 90 business migrations and 142 entities. E2E covered critical incident, two-person approval, CAPA source linkage, independent verifier, tenant-scoped dashboard/severity data and a 12-month trend series. `cloudAccess=false`.
- Legal compliance reports, retention, browser acceptance and customer-account validation remain open.

### C02 / 2.02 - Item unit conversions (partial)

- Added the registered conversion catalog, a quantity preview and migration `202611020010`. Base quantities use the material unit; mappings select the effective period, preserve started-period factors and reject overlapping periods. Any item reference blocks changing its base unit.
- `--verify-master-data` passed nonblank units, unused-unit edits, referenced-unit protection, historical/current/future factors, period overlap, positive factors, serial integrality, tenant and row scope, module-off denial and direct-table denial. Six mocked API tests passed validation and parameter forwarding.
- This does not yet attach source-unit/factor snapshots to purchasing, warehouse or production lines. Excel import/conflict handling, aliases/merge history and browser acceptance remain open. Operational rules are recorded in [item-unit-conversions.md](item-unit-conversions.md).
