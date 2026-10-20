# Thiết kế giao diện tin nhắn — 19/10/2026

## Phạm vi

- Trang Tin nhắn: danh sách hội thoại, khung trò chuyện, tạo hội thoại/nhóm và ô soạn tin.
- Cửa sổ chat nhỏ: danh sách, quay lại, mở hội thoại đầy đủ, thu nhỏ/đóng và ô soạn tin.
- `ChatTranscript` dùng chung cho hai nơi: mốc ngày, nhóm tin liên tiếp cùng người, avatar chữ, bong bóng gửi/nhận, giờ gửi, thẻ tệp/PDF và phiếu lương.
- Bỏ tiêu đề trang trùng ở route hội thoại. Dùng token màu, radius và kích thước control chung; điện thoại giữ vùng chạm 44px và input 16px.

## Giữ nghiệp vụ

- API chat, quyền tham gia hội thoại, payload gửi/tạo nhóm, upload tệp và Supabase realtime giữ nguyên.
- Không thêm trạng thái online/đang nhập/đã xem giả, gọi điện hoặc hành động chưa có backend. Dấu gửi chỉ áp dụng cho tin đã được API trả về, không thể hiện người nhận đã đọc.
- Liên kết tải tệp và mở phiếu lương giữ route có kiểm tra quyền hiện có.
- Không tạo nhóm, gửi tin, gửi phiếu hoặc sửa dữ liệu để thử giao diện. Không có migration.

## Kiểm tra

- Rà soát source cho desktop/mobile, xung đột CSS cũ, chiều cao viewport, cuộn nội dung, composer và bộ chọn người nhận.
- TypeScript, ESLint và build/health được ghi trong biên nhận triển khai.
- Không chạy browser hoặc bộ test tự động trong lượt này; chưa xác nhận bàn phím trên điện thoại thật.
