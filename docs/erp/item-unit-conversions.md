# Quy đổi đơn vị vật tư

Đơn vị cơ sở nằm tại `items.unit`. Danh mục `item_unit_conversions` thuộc module kho, dùng phiên đăng nhập doanh nghiệp và quyền trên từng vật tư/quy đổi. Các bảng mới bật RLS và chỉ cho truy cập qua RPC.

## Hiệu lực và lịch sử

- Hệ số là số đơn vị cơ sở tương ứng với một đơn vị nhập. Ví dụ một hộp bằng 12 kg thì hệ số bằng 12.
- Một vật tư và đơn vị nhập chỉ có một quy đổi đang hoạt động tại mỗi ngày. Ngày đầu và ngày cuối đều thuộc kỳ hiệu lực. Tên đơn vị được so khớp sau khi bỏ khoảng trắng hai đầu và không phân biệt hoa/thường.
- Sau ngày bắt đầu hiệu lực, không sửa vật tư, tên đơn vị, hệ số, ngày bắt đầu hoặc trạng thái. Có thể đóng kỳ bằng ngày kết thúc từ hôm nay trở đi; kỳ đã kết thúc trong quá khứ được giữ nguyên.
- Muốn đổi hệ số: đóng kỳ hiện tại, tạo dòng mới bắt đầu từ ngày tiếp theo. Dòng cũ tiếp tục phục vụ tra cứu ngày cũ.
- Không đổi đơn vị cơ sở nếu vật tư có bất kỳ khóa ngoại tham chiếu nào, kể cả chứng từ nháp và dòng quy đổi. Vật tư chưa có tham chiếu vẫn có thể được sửa đơn vị.
- Đơn vị cơ sở không được để trống. Trước rollout cần đối chiếu dữ liệu hiện có với ràng buộc mới; migration sẽ từ chối nếu đã có giá trị trống.

## Tra cứu số lượng

Danh sách quy đổi có công cụ chọn vật tư, đơn vị nhập, số lượng và ngày hiệu lực. API tương ứng:

```text
GET /api/v1/business/{slug}/items/convert-quantity?itemId={uuid}&fromUnit=box&quantity=2&on=2026-11-02
```

RPC `business_item_quantity_conversion` suy ra tenant từ session. Đơn vị trùng đơn vị cơ sở dùng hệ số 1; đơn vị khác phải có dòng quy đổi có hiệu lực và người dùng phải được đọc dòng đó. Kết quả chứa hệ số, số lượng cơ sở và ID phiên bản quy đổi. Số lượng cơ sở được làm tròn 4 chữ số thập phân; kết quả dưới 0,0001 hoặc trên giới hạn số lượng bị từ chối. Vật tư theo số sê-ri chỉ chấp nhận số lượng cơ sở nguyên.

Hiện công cụ hỗ trợ tính thử. Các phiếu kho, mua hàng và sản xuất vẫn lưu số lượng theo đơn vị cơ sở; chưa tự nhận đơn vị thay thế hoặc lưu snapshot đơn vị/hệ số trên từng dòng chứng từ. Quy đổi qua nhiều bước và quy đổi nghịch đảo chưa được suy diễn tự động.

## Kiểm chứng

`--verify-master-data` trong `compile-business-schema.mjs` kiểm tra ràng buộc đơn vị, lịch sử hiệu lực, kỳ chồng nhau, thay đổi đơn vị khi đã có chứng từ, số sê-ri, tenant, phạm vi quyền, module tắt và quyền truy cập bảng. Các kiểm tra API có mock RPC nằm trong `business-read-routes.test.ts`; chúng xác nhận validation và chuyển tiếp đúng tham số, không thay thế kiểm chứng đăng nhập hoặc trình duyệt thật.
