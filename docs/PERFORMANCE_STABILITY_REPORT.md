# Báo cáo hiệu năng và độ ổn định — MASTER 04

Cập nhật: 2026-09-15 (Asia/Ho_Chi_Minh)

## Kết luận kỹ thuật

Không có dữ liệu để khẳng định một nguyên nhân duy nhất cho phản ánh “chậm hoặc tự thoát trang” trên môi trường thật. Rà soát source xác định ba failure mode có thể tái hiện bằng test: fan-out reconcile khi Realtime phát burst, promise nền bị reject nhưng không được bắt, và phản hồi tìm kiếm cũ có thể cập nhật trạng thái sau yêu cầu mới. Các đường này đã được cô lập và có regression test tương ứng. Route group authenticated cũng có error boundary riêng, vì vậy lỗi render/query cục bộ không còn mặc định phá hủy toàn bộ shell.

Không thay đổi authentication/session, RLS, API contract, mutation hay kiến trúc phân quyền. Không có credential staging trong workspace nên chưa thể tái hiện hoặc kết luận về logout giả, token refresh cạnh tranh, tải dữ liệu lớn và hai tài khoản Realtime.

## Kịch bản và bằng chứng

| Kịch bản | Triệu chứng baseline / bằng chứng source | Thay đổi | Kết quả sau sửa | Giới hạn |
| --- | --- | --- | --- | --- |
| Burst 100 invalidation cùng domain | Hook gọi `reconcile()` độc lập cho từng event và không bắt rejection | Một request đang chạy; event đến trong lúc đó được coalesce thành đúng một trailing reconcile | Test 100 event: 1 lần đang chạy + 1 lần trailing | Chưa đo CPU/network với dữ liệu staging |
| Reconcile nền thất bại | Promise bị bỏ lửng có thể tạo `unhandledrejection` | Bắt lỗi ở biên hook; consumer vẫn sở hữu UI lỗi của chính nó | Regression test xác nhận rejection được chứa và route không bị throw từ hook | Không thay thế monitoring lỗi API server |
| Refresh route từ event dồn dập | `router.refresh()` có thể chạy cho từng event route-level | Debounce/coalesce 180 ms và cleanup timer/subscription | Source contract + toàn bộ test đạt | Chưa profile React commit authenticated |
| Gõ tìm kiếm nhanh | Request trước có thể hoàn tất sau request mới; `.finally` cũ có thể thay đổi loading hiện tại | Abort request cũ, sequence latest-request-wins, chỉ request mới nhất được cập nhật kết quả/loading | Lint/typecheck/test đạt; không còn stale state path trong source | Chưa có network-throttling browser test authenticated |
| Điều hướng/mount-unmount lặp 30 lần | Nguy cơ listener lifecycle tích lũy | Coordinator giữ reference count và cleanup; bổ sung test cân bằng listener | 30 lần add `focus` tương ứng 30 lần remove | Không có session để đo channel Supabase thật |
| Lỗi trong route authenticated | Chỉ có root error boundary | Thêm `src/app/(app)/error.tsx`, giữ shell và cung cấp retry có mã đối chiếu | Build route group đạt | Chưa cố tình gây lỗi trên staging |
| Nhiều kích thước/zoom | Nguy cơ tràn ngang và font fallback làm đổi geometry | Sweep production, chờ font thật, kiểm computed font và glyph Việt | 14 viewport 320–2560 px và zoom 80/100/125/150% đều không tràn ở login | Shell authenticated chưa chụp do thiếu phiên |
| Phiên/auth khi nhiều action | Prompt nêu khả năng logout giả nhưng không có reproduction log hoặc credential | Chỉ audit; không sửa auth khi chưa xác định failure mode | Protected routes vẫn redirect đúng khi hoàn toàn không có phiên | Cần staging account để kiểm refresh/offline/5xx/2–5 tab |

## Nguyên nhân và phạm vi sửa

1. Realtime consumer thiếu backpressure. Việc coalesce nằm tại `useDomainReconciliation`, không thay đổi channel, authorization, event identity hoặc domain scope.
2. Route refresh thiếu khoảng gom sự kiện. Timer mới chỉ giảm refresh trùng trong burst và được hủy khi pathname/subscription đổi.
3. Tìm kiếm không có quyền sở hữu response rõ ràng. AbortController và sequence number đảm bảo response cũ không ghi đè response mới.
4. Error containment quá rộng. Boundary mới đặt bên trong `(app)` để shell không bị thay thế bởi root error page khi route child lỗi.

## Số đo và gate đã chạy

- Realtime burst: 100 event đại diện; tối đa 2 reconcile khi request đầu còn chạy.
- Listener lifecycle: 30 vòng mount/unmount; add/remove cân bằng 30/30 cho listener `focus`.
- Browser production: 14 viewport từ 320×800 đến 2560×1440; `scrollWidth === clientWidth` trên login.
- Zoom production: 80%, 100%, 125%, 150%; không tràn ngang trên login.
- Font browser: computed body là `Roboto`; bộ glyph tiếng Việt nghiệp vụ đạt; weight 400/500/600/700 tải thành công; không có response font lỗi HTTP.
- Không ghi số CPU, long-task, memory, request latency hoặc render duration vì không có một phiên authenticated/dataset đại diện để đo trung thực.

## Việc cần xác nhận trên staging

- Dùng account theo role HR, quản lý, kho và XNK để chạy các action đồng thời trên màn thật.
- Hai account và 2–5 tab: xác nhận authorization, dedup, reconnect và số channel Supabase không tăng.
- Mô phỏng slow/timeout/offline/5xx trong lúc token refresh; xác nhận không logout giả và return URL được giữ.
- Dữ liệu lớn đại diện: employee, ledger, shipment, audit; ghi network count, interaction latency, long tasks và memory trước/sau.
- Cố tình làm hỏng một widget/query để kiểm error containment trong shell.

Các mục trên là blocker kiểm thử môi trường, không phải kết quả đã đạt.
