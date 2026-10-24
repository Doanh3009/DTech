# Tiến độ triển khai nghiệp vụ tham chiếu MISA

Ngày cập nhật: 24/10/2026. Hai DOCX là nguồn yêu cầu tham khảo. Bảng này ghi phần triển khai hiện có, không thay thế nghiệm thu và không xác nhận hệ thống tuân thủ toàn bộ chế độ kế toán/thuế.

## Trạng thái môi trường

- Mã nguồn: 115 thực thể nghiệp vụ, 13 capability; có dữ liệu mô phỏng cho sáu ngành.
- Migration `202610240005`–`202610240038` đã áp dụng trên Supabase phát triển `tcjjhxqtreemccdbvyza` sau khi người dùng xác nhận quyền cập nhật.
- Đã nạp dữ liệu bổ sung tài chính, vận hành, chấm công và CRM bằng các command nghiệp vụ. Không nạp lại seed tạo tenant.
- Đích Vercel: project riêng `dimixo-erp`, dùng database phát triển; tình trạng phát hành ghi tại bằng chứng triển khai. Project ERP nội bộ hiện tại không được đổi database.
- Bản hiện tại đã phát hành tại [DIMIXO ERP](https://dimixo-erp.vercel.app), dùng Next.js và vùng xử lý Singapore. Trang giới thiệu, đăng nhập, chọn doanh nghiệp và readiness database đã đối chiếu qua HTTP; đây không phải nghiệm thu toàn bộ nghiệp vụ MISA.
- Dữ liệu ERP nội bộ và hai project được bảo vệ không thuộc phạm vi cập nhật.

## Phần đã triển khai local

| Nhóm | Nghiệp vụ và kiểm soát đã có | Phần còn thiếu / giới hạn |
| --- | --- | --- |
| C01–C03 | Session suy ra tenant; chủ doanh nghiệp cấp/khóa/mở/cấp lại tài khoản; liên kết nhân viên; hạn truy cập và hạn quyền chi tiết; tự khóa tài khoản liên kết khi ngừng hồ sơ nhân viên; thu hồi session; mẫu quyền xem/nhập/duyệt; báo cáo tách chứng từ; phạm vi người tạo/công trình/phòng ban; nhật ký xem được trong ERP; CAS và request UUID | Chưa đầy đủ danh mục tổ chức/chức danh có lịch sử, mời qua email, chuyển chủ sở hữu và ủy quyền theo hiệu lực |
| S01–S04 | Chiến dịch/kênh/chi phí; chống trùng email/điện thoại lead; ghi consent; đánh giá đủ điều kiện; chuyển lead thành khách/cơ hội có liên kết nguồn; owner và xác suất; báo giá phiên bản/chiết khấu/hiệu lực; phản hồi khách; hợp đồng lấy giá đã chấp nhận; phụ lục; đặt hàng từng đợt có giới hạn còn lại; ticket/phản hồi/giải quyết/đóng/mở lại/chuyển cấp; pipeline, chi phí/lead và SLA từ chứng từ | Chưa nối form/kênh marketing bên ngoài, gửi email tự động, lịch hẹn/cộng tác và toàn bộ trường hợp dịch vụ/bảo hành/điều khoản thanh toán hợp đồng. Báo giá và hợp đồng hiện ghi giá trước thuế; thuế ghi nhận ở hóa đơn |
| C04 | Chứng từ mới có nhập nháp → tính/đối chiếu → người khác duyệt → ghi nhận; sửa dòng hủy kết quả tính và phê duyệt; nguồn thay đổi buộc đối chiếu lại | Chưa có cấu hình workflow nhiều cấp theo phiên bản, ủy quyền và biểu mẫu động |
| C07 | Dashboard doanh nghiệp theo ngành, sổ kế toán, đối chiếu mua hàng, bảng nguồn tài sản/ngân hàng/tạm ứng/vay/thuế/giá thành, bảng công và ngân sách | Chưa đầy đủ BI tùy biến, tìm kiếm toàn văn và biểu mẫu xuất/in theo từng chuẩn |
| F01 | Thu/chi, tiền mặt/ngân hàng, tạm ứng–quyết toán–hoàn quỹ, khế ước–giải ngân–trả gốc/lãi thực tế, đối chiếu từng phần sao kê; kiểm tra số dư tại ngày và số dư tương lai | Chưa kết nối ngân hàng thật; đề nghị thanh toán và hạn mức nhiều cấp còn thiếu |
| F02 | Bút toán kép; kỳ kế toán; duyệt khác người lập; bút toán đã ghi sổ không sửa trực tiếp; đảo có phụ thuộc; công nợ, thu/chi, hóa đơn; điều chỉnh giảm và hoàn tiền; kết chuyển; báo cáo cấu hình từ sổ cái | Chưa nghiệm thu đủ mẫu báo cáo theo chế độ kế toán; đối chiếu hóa đơn theo từng dòng nhận hàng, GRNI và xử lý chênh giá đến sau còn thiếu |
| O06 / tài sản | Ghi tăng tham chiếu chứng từ hình thành; kiểm soát phần nguyên giá chưa dùng; tài sản/CCDC/trả trước; phân bổ theo ngày, bàn giao/thu hồi, bảo dưỡng, ghi giảm; đảo theo thứ tự phụ thuộc | Còn thiếu kiểm kê tài sản nhiều đợt, nâng cấp/đánh giá lại, sửa chữa lớn và thanh lý đầy đủ các trường hợp |
| F03 | Tập hợp vật tư theo giá bình quân thực tế, nguồn chi phí đã ghi sổ, phân bổ lương và chi phí chung; dở dang; hoàn thành một phần; giá thành theo lần nhập; giá xuất và giá vốn; chặn sửa nguồn đã tiêu thụ | Còn thiếu đầy đủ phương pháp hệ số/tỷ lệ/phân bước, dự toán theo mã chi phí và xử lý chi phí/giá hóa đơn đến sau |
| O03 | Đề nghị mua, các dòng nhu cầu, nhiều báo giá, so sánh báo giá đủ phạm vi, chọn từng phần, sinh đơn mua/dòng có nguồn; nhận một phần; kiểm soát số lượng đã đặt xuyên nhiều báo giá | Chưa đầy đủ RFQ gửi nhận, trả hàng mua, thuế/phí mua phân bổ, quy đổi đơn vị và đối chiếu hóa đơn theo dòng |
| O04 | Ledger kho, lô/serial/chất lượng; điều chuyển có hai vế; kiểm kê có khóa kho, chênh lệch và định khoản; hoàn trả vật tư về phiếu xuất gốc; chặn âm tồn theo ngày và các ngày sau | Còn thiếu giữ hàng/vị trí kho, kiểm kê nhiều tổ, UOM có lịch sử quy đổi và các trường hợp nhập/xuất đặc biệt |
| O01 | WBS, ngân sách theo phiên bản/lý do, hạn mức bổ sung; điều chỉnh khối lượng hợp đồng; nghiệm thu không vượt khối lượng; đối chiếu nghiệm thu–hóa đơn; tạm dừng/tiếp tục/khóa công trình | Hạn mức hiện kiểm soát ở tổng công trình; chưa đầy đủ theo WBS/khoản mục, hợp đồng chủ đầu tư, bảo hành/giữ lại, quyết toán và giao việc |
| H03 | Ca ngày/đêm với ngày công cấu hình; phân ca và chặn trùng; nghỉ hưởng/không hưởng lương; hạn mức phép; OT được duyệt; xác nhận ca tạo một phiếu công; khóa kỳ; nguồn công đã vào lương không tự sửa | Chưa kết nối thiết bị/QR/check-in; lịch thay đổi tổ chức và phân công chưa đầy đủ |
| H04–H05 | Công thường và phép hưởng lương vào điều kiện tính lương; thuế/đóng góp theo hồ sơ, chính sách có hiệu lực và bậc cấu hình; phân bổ chi phí lương; khấu trừ riêng, khoản doanh nghiệp chịu; chi trả từng nhân viên, số dư lương phải trả và chặn chi vượt/đảo bảng lương đã chi | Chưa đầy đủ cơ cấu thu nhập theo hợp đồng/phiên bản, các khoản lương phức tạp và hồ sơ BHXH/thuế gửi thực tế. Hệ số và thuế suất trong demo chỉ là cấu hình minh họa |

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

C05–C06: lưu trữ/phiên bản văn bản, ký số và cộng tác; phần tích hợp/kênh/bảo hành còn thiếu của S01–S04; O02: giao việc/đội/tiến độ; O07: HSE/CAPA; H01/H02/H06: tuyển dụng, hợp đồng/biến động nhân sự, KPI/OKR; C04 nhiều cấp; các nghiệp vụ tài chính và xuất/in còn thiếu trong bảng trên.

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

Chứng cứ biên dịch/schema: [industry-schema-build.json](../commercial-erp/evidence/industry-schema-build.json). Không có test suite nghiệp vụ/UI được thêm hoặc chạy trong đợt này; luồng phát sinh dữ liệu mẫu, typecheck, lint và build không thay thế nghiệm thu các trường hợp được đề xuất trong DOCX.
