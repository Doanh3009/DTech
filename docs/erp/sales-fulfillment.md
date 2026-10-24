# Giao hàng theo đơn bán

Phạm vi: ERP khách hàng dùng Supabase chung, bảng `business_*` tách theo `tenant_id`. Module Bán hàng cần bật Kho và Khách hàng. Tài khoản viewer chỉ xem tiến độ.

## Luồng sử dụng

1. Tạo hàng hóa, kho và đối tác khách hàng. Nhập và ghi nhận tồn đầu vào.
2. Tạo đơn bán và chi tiết đơn, sau đó phát hành. Công nợ đơn được tạo theo hợp đồng nghiệp vụ hiện có; đây chưa phải hóa đơn thuế hoặc kế toán tổng hợp.
3. Mở đơn bán → **Tiến độ giao hàng** → **Thêm hàng giao**. Chọn hàng, kho/lô, số lượng, đơn giá và ngày giao.
4. **Giao hàng & xuất kho** ghi toàn bộ phiếu xuất trong một transaction. Có thể giao từng phần. Lỗi ở bất kỳ dòng nào hoàn tác toàn bộ lần giao.
5. Hoàn thành đơn khi số lượng thực giao đủ. Thu tiền tại module Thu tiền theo khoản phải thu; không cho thu vượt phần còn lại.
6. Đảo phiếu xuất bằng hành động hiện có tại Nhập / xuất kho. Đơn đã hoàn thành tự mở lại nếu số lượng giao ròng giảm; công nợ giữ nguyên theo giá trị đơn. Nghiệp vụ hủy đơn/giảm công nợ cần command điều chỉnh riêng.

## Ràng buộc

- Session business xác định tenant; request không truyền tenant hoặc account để cấp quyền.
- Chỉ hàng nằm trong đơn, kho/lô cùng doanh nghiệp; kiểm tra tồn và chất lượng/hạn dùng theo quy tắc kho.
- Tổng xuất ròng của từng mặt hàng không vượt tổng đặt. Tổng trả không vượt tổng đã giao. Trigger kiểm soát tại bảng sổ kho nên lệnh nhập/xuất thủ công tuân thủ cùng giới hạn.
- Thay đổi giao hàng tăng phiên bản đơn. Hai người giao cùng phiên bản không thể cùng ghi; một người cần tải lại.
- Tối đa 50 dòng một lần; số lượng/đơn giá tối đa 4 chữ số thập phân. Ngày giao không trước ngày đặt hoặc sau ngày hiện tại ở Việt Nam.
- Request UUID, payload, người thực hiện và receipt giữ nguyên khi thử lại. Timeout hoặc receipt không khớp giữ yêu cầu chờ; không báo thành công trước khi có xác nhận.
- Chứng từ đã ghi nhận giữ số lượng gốc; điều chỉnh qua phiếu đảo. Nhật ký, phiên bản, sổ kho và receipt ghi nguyên tử.

## Triển khai và bằng chứng

Migration `202610230010_business_sales_fulfillment.sql` phụ thuộc bốn migration `202610230001`–`202610230004`. Migration `202610230011_business_session_serialization.sql` kiểm tra lại phiên dưới khóa sau khi khóa doanh nghiệp/tài khoản, bảo đảm đăng xuất có hiệu lực với lệnh đang chờ và hai phiên đổi mật khẩu không deadlock. Chưa áp dụng cloud trong đợt này.

Native PostgreSQL chạy bằng `node supabase/tests/business-platform.integration.mjs`, dùng cluster tạm, dữ liệu tổng hợp và không truy cập cloud. Bằng chứng mới nhất ở `docs/commercial-erp/evidence/business-platform-integration.json`, có hash migration và các case riêng cho giao hàng. Test API/component nằm cạnh source. Native không thay thế UAT, kiểm tra Supabase Auth nội bộ hoặc nghiệm thu kế toán.
