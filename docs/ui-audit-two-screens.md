# Audit UI hai màn hình ERP — PROMPT 00

Ngày audit: 25/09/2026  
Baseline: commit `c6327f0` trên nhánh `erp-v2-stages-00-02`, kèm các thay đổi chưa commit đang có trong workspace. Vì vậy bộ ảnh bên dưới là trạng thái **trước PROMPT 01/02**, không phải ảnh của một clean checkout lịch sử.

## 1. Phạm vi và kết luận nhanh

Phạm vi đã audit:

- Gói / Công trường: danh sách gói, header ngữ cảnh, tabs và màn Thi công.
- Dashboard: giữ nguyên vùng chào hỏi, ngày, “Ứng dụng của tôi”; audit toàn bộ nội dung từ “Tác vụ nhanh” trở xuống.
- Hai viewport: `1440×900` và `390×844`.
- Đối chiếu chuẩn compact list/data surface từ module Kho ở source. Trình duyệt bị chặn đúng bởi quyền của `test.supervisor`, nên không dùng ảnh màn Kho như một baseline trực quan hợp lệ.

Kết luận:

1. Dashboard đã có skeleton nhanh hơn, nhưng nội dung thật vẫn chờ toàn bộ widget phía server; đo lại cho thấy feedback đầu tiên `779 ms`, nội dung sẵn sàng `3.147 s`.
2. Dashboard desktop ép ba card đầu cao bằng nhau; mobile còn nghiêm trọng hơn: ẩn “Ứng dụng của tôi”, KPI, biểu đồ và cả “Ghi chú nhanh”, đồng thời đẩy “Việc cần làm” lên trước lời chào.
3. Màn Thi công đang báo `100% hoàn thành · 1 đang thi công · 2 vướng`. Đây là dữ liệu hợp lệ theo schema hiện tại nhưng là ngữ nghĩa UI mâu thuẫn: phần trăm và trạng thái được tính/ghi độc lập.
4. Danh sách gói không tràn ngang và mobile card khá rõ, nhưng desktop quá thưa, không hiển thị quản lý dù selector tìm kiếm đã dùng trường này.
5. Khu “Hôm nay & 7 ngày” chiếm quá nhiều chiều dài; trên mobile nó biến thành một khối dài sau danh sách việc. Tên công việc bị `ellipsis` trên cả desktop và mobile; quan hệ cha/con gần như mất trên mobile.
6. Cơ chế gom Attention có khử trùng theo `href`, nhưng nguồn lô hàng vẫn sinh một item cho mỗi flag. Bản thân widget lô hàng vì vậy vẫn có thể lặp cùng một lô; logic loại item khỏi khu bên dưới chỉ loại đúng `type:id`, không loại toàn bộ các flag cùng entity.

PROMPT 00 chỉ tạo audit và blueprint. Chưa sửa UI, auth, DB, RLS, realtime, route hay nghiệp vụ.

## 2. Bằng chứng trình duyệt “before”

### Dashboard

| Viewport | Ảnh |
|---|---|
| 1440×900, đầu trang | [before-dashboard-top-1440x900.png](ui-evidence/two-screen-audit/before-dashboard-top-1440x900.png) |
| 1440×900, từ Tác vụ nhanh | [before-dashboard-below-apps-1440x900.png](ui-evidence/two-screen-audit/before-dashboard-below-apps-1440x900.png) |
| 1440×900, toàn trang | [before-dashboard-full-1440x900.png](ui-evidence/two-screen-audit/before-dashboard-full-1440x900.png) |
| 390×844, đầu trang | [before-dashboard-top-390x844.png](ui-evidence/two-screen-audit/before-dashboard-top-390x844.png) |
| 390×844, từ Tác vụ nhanh | [before-dashboard-below-apps-390x844.png](ui-evidence/two-screen-audit/before-dashboard-below-apps-390x844.png) |
| 390×844, toàn trang | [before-dashboard-full-390x844.png](ui-evidence/two-screen-audit/before-dashboard-full-390x844.png) |

### Gói / Công trường

| Viewport | Ảnh |
|---|---|
| 1440×900, danh sách | [before-projects-list-1440x900.png](ui-evidence/two-screen-audit/before-projects-list-1440x900.png) |
| 390×844, danh sách | [before-projects-list-390x844.png](ui-evidence/two-screen-audit/before-projects-list-390x844.png) |
| 1440×900, Thi công đầu trang | [before-project-progress-top-1440x900.png](ui-evidence/two-screen-audit/before-project-progress-top-1440x900.png) |
| 1440×900, Thi công cuối trang | [before-project-progress-bottom-1440x900.png](ui-evidence/two-screen-audit/before-project-progress-bottom-1440x900.png) |
| 1440×900, Thi công toàn trang | [before-project-progress-full-1440x900.png](ui-evidence/two-screen-audit/before-project-progress-full-1440x900.png) |
| 390×844, Thi công đầu trang | [before-project-progress-top-390x844.png](ui-evidence/two-screen-audit/before-project-progress-top-390x844.png) |
| 390×844, Thi công cuối trang | [before-project-progress-bottom-390x844.png](ui-evidence/two-screen-audit/before-project-progress-bottom-390x844.png) |
| 390×844, Thi công toàn trang | [before-project-progress-full-390x844.png](ui-evidence/two-screen-audit/before-project-progress-full-390x844.png) |

### Baseline Kho bị chặn theo quyền

- [blocked-warehouse-receipts-1440x900.png](ui-evidence/two-screen-audit/blocked-warehouse-receipts-1440x900.png)
- [blocked-warehouse-receipts-390x844.png](ui-evidence/two-screen-audit/blocked-warehouse-receipts-390x844.png)

## 3. Route, component và luồng dữ liệu hiện tại

### 3.1 Gói / Công trường

| Lớp | Nguồn | Vai trò |
|---|---|---|
| Route danh sách | [`src/app/(app)/projects/page.tsx`](<../src/app/(app)/projects/page.tsx>) | `PageHeader` + `ProjectList`. |
| UI danh sách | [`ProjectPortfolioWorkspace.tsx`](../src/features/projects/components/ProjectPortfolioWorkspace.tsx) | Client fetch `/api/v1/projects`, tìm kiếm, lọc nhóm, render row/card. |
| API danh sách | [`api/v1/projects/route.ts`](../src/app/api/v1/projects/route.ts) | GET yêu cầu `project.view`; POST yêu cầu `project.create`. |
| Selector/repository | [`projectRepository.ts`](../src/features/projects/services/projectRepository.ts) | `projectSelect`, manager relation, worksite count, unique active people. |
| Route chi tiết | [`projects/[id]/[section]/page.tsx`](<../src/app/(app)/projects/[id]/[section]/page.tsx>) | Chuyển `id` và `section` vào page server. |
| Page chi tiết | [`ProjectDetailPage.tsx`](../src/features/projects/pages/ProjectDetailPage.tsx#L13) | Đọc project; riêng tab progress tải cây việc và lịch 7 ngày bằng `Promise.allSettled`. |
| Shell workspace | [`PackageWorkspace.tsx`](../src/features/projects/components/package-workspace/PackageWorkspace.tsx#L30) | Ghép header, tabs, body; lọc tab theo permission. |
| Header/tabs | [`PackageContextHeader.tsx`](../src/features/projects/components/package-workspace/PackageContextHeader.tsx), [`WorkspaceNav.tsx`](../src/features/projects/components/package-workspace/WorkspaceNav.tsx) | Dùng shared `EntityContextHeader` và `ContextTabs`. |
| Thi công | [`PackageConstructionWorkspace.tsx`](../src/features/projects/components/package-workspace/PackageConstructionWorkspace.tsx#L70) | Client state, filter cây, quick update, drawer sửa việc/cập nhật hiện trường. |
| Style | [`PackageWorkspace.module.css`](../src/features/projects/components/package-workspace/PackageWorkspace.module.css) và [`globals.css`](../src/app/globals.css#L7150) | Chi tiết dùng CSS module; danh sách gói còn dùng global selectors và có nhiều override mobile về cuối file. |

Luồng ngắn:

```text
/projects
  -> ProjectPortfolioWorkspace
  -> GET /api/v1/projects
  -> listProjects(user)
  -> client useMemo(filter + group)
  -> project row -> /projects/:id/progress

/projects/:id/progress
  -> ProjectDetailPage (server)
  -> getProject + Promise.allSettled(listProjectProgress, getProjectSchedule)
  -> PackageWorkspace
  -> PackageConstructionWorkspace
  -> PATCH/POST progress + POST field update khi người dùng thao tác
  -> useDomainReconciliation("projects") cho danh sách
```

### 3.2 Dashboard

| Lớp | Nguồn | Vai trò |
|---|---|---|
| Route | [`src/app/(app)/dashboard/page.tsx`](<../src/app/(app)/dashboard/page.tsx>) | Gọi `DashboardPage`. |
| Page server | [`DashboardPage.tsx`](../src/features/foundation/pages/DashboardPage.tsx#L10) | Auth/area guard, chờ `getDashboardReadModel`, truyền `initialModel`. |
| Read model | [`dashboardService.ts`](../src/features/dashboard/services/dashboardService.ts#L306) | Chọn profile/widget theo permission; tải widget song song; gom Attention. |
| Registry | [`registry.ts`](../src/features/dashboard/registry.ts) | Profile, thứ tự widget, quick action và permission. |
| Attention selector | [`attention.ts`](../src/features/dashboard/attention.ts#L13) | Sort theo mức độ và gom theo `href`. |
| UI | [`DashboardView.tsx`](../src/features/dashboard/components/DashboardView.tsx#L462) | Render app launcher, quick action, KPI, inbox, todo, note, chart, operational sections. |
| Client data cá nhân | [`DashboardView.tsx`](../src/features/dashboard/components/DashboardView.tsx#L346) | Fetch note, todo và workspace preferences sau hydrate. |
| Style | [`theme.css`](../src/app/theme.css#L594), [`globals.css`](../src/app/globals.css#L9854) | Nhiều thế hệ rule dashboard chồng nhau; `theme.css` được import sau `globals.css`. |

Luồng ngắn:

```text
/dashboard
  -> DashboardPage (server)
  -> getDashboardReadModel
     -> read dashboard settings
     -> resolve profile + enabled widgets
     -> Promise.allSettled(all enabled loaders)
     -> normalizeAttention(all priority items)
  -> DashboardView(initialModel)
  -> client fetch preferences/note/todos
  -> realtime reconciliation chỉ refetch khi domain thay đổi
```

## 4. Kết quả đo và kiểm tra kỹ thuật

| Hạng mục | 1440×900 | 390×844 | Kết quả |
|---|---:|---:|---|
| Dashboard ổn định sau điều hướng trực tiếp | 4.946 s | 4.426 s | Chậm; số này gồm chờ network idle. |
| Dashboard click từ `/projects`, feedback đầu | 0.779 s ở QA 1920×1080 | \- | Có route skeleton. |
| Dashboard click từ `/projects`, nội dung thật | 3.147 s ở QA 1920×1080 | \- | Không còn client fetch `/api/v1/dashboard`, nhưng vẫn chờ server model. |
| Danh sách gói ổn định | 3.832 s | 3.990 s | Chậm so với lượng dữ liệu hiện tại (1 row). |
| Tab Thi công ổn định | 5.617 s | 5.401 s | Chậm nhất trong phạm vi audit. |
| Tràn ngang document | Không | Không | `scrollWidth <= clientWidth`. |
| Hydration/page error | 0 | 0 | Không tái hiện lỗi hydration. |
| Sticky tabs | Không cần trên desktop | `top: 60px`, cao 54 px | Hoạt động, không che nội dung trong lượt đo. |
| Mobile field-update CTA | Không render với role audit | Không render với role audit | Chưa thể xác minh overlap bằng role hiện có. |

Console/network quan sát được:

- `GET /api/v1/workspace/avatar?v=0` trả `404` lặp theo mỗi route; nguồn gọi là [`UserMenu.tsx`](../src/components/shared/UserMenu.tsx#L35). Đây là AppShell ngoài phạm vi hai màn hình, nhưng gây nhiễu console/network.
- Pattern username `[A-Za-z][A-Za-z0-9._-]{2,31}` tạo lỗi regex với chế độ `/v` của trình duyệt mới; có ở [`LoginForm.tsx`](../src/features/auth/components/LoginForm.tsx#L18) và hai form quản trị tài khoản. Không phải lỗi layout nhưng là lỗi console xác nhận được.
- WebSocket Supabase bị `ERR_NETWORK_ACCESS_DENIED` trong môi trường headless bị hạn chế mạng; không đủ bằng chứng kết luận realtime production hỏng.
- Các request preferences `ERR_ABORTED` xuất hiện khi script rời route; đây là abort theo vòng đời navigation, không phải lỗi API đã xác nhận.
- Mobile có cảnh báo LCP cho logo `/brand/chau-tuan-logo.png` chưa `loading="eager"`; nằm ngoài phạm vi nội dung hai màn hình.

## 5. Vấn đề và nguyên nhân gốc

### P0 — Mobile Dashboard phá vỡ vùng đầu trang được yêu cầu giữ nguyên

**Bằng chứng:** ảnh mobile mở bằng “Việc cần làm”; không có “Ứng dụng của tôi”, KPI, biểu đồ và “Ghi chú nhanh”. Lời chào nằm sau ba card cá nhân.

**Nguyên nhân:** [`theme.css:866-867`](../src/app/theme.css#L866) áp dụng riêng supervisor:

- `display: none` cho `.module-launcher`, `.dashboard-overview`, `.dashboard-visuals`, `.dashboard-operations`, `.dashboard-note`.
- `order: -1` cho `.dashboard-personal-grid`.

**Hệ quả:** khác desktop, sai yêu cầu giữ greeting/date/My Apps và làm mất chức năng ghi chú trên mobile.

**Hướng xử lý ở PROMPT 02:** không redesign vùng đầu; chỉ gỡ hành vi ẩn/đổi thứ tự để cùng một hierarchy và permission ở mọi viewport.

### P0 — Tiến độ 100% nhưng vẫn đang thi công/vướng

**Bằng chứng thực tế:** project `CT-2026-015` có:

- Header: `100%` và trạng thái package “Đang thi công”.
- Summary: `100% hoàn thành · 1 đang thi công · 2 vướng`.
- Ba node đều `100%`; một node `in_progress`, hai node `blocked`.
- API danh sách còn trả `status=active`, `health=completed`.

**Nguyên nhân:**

- [`PackageWorkspace.tsx:56-58`](../src/features/projects/components/package-workspace/PackageWorkspace.tsx#L56) và [`PackageConstructionWorkspace.tsx:119-120`](../src/features/projects/components/package-workspace/PackageConstructionWorkspace.tsx#L119) chỉ lấy trung bình `completionPercent` của root.
- Status được lưu riêng. Quick action “Vướng” giữ nguyên phần trăm; “+5/+10” có thể đặt `in_progress` dù phần trăm đã đạt 100 ([`PackageConstructionWorkspace.tsx:157-166`](../src/features/projects/components/package-workspace/PackageConstructionWorkspace.tsx#L157)).
- Roll-up parent ưu tiên `blocked` nếu bất kỳ child blocked, bất kể completion là 100 ([`projectRepository.ts:202-206`](../src/features/projects/services/projectRepository.ts#L202)).
- UI dùng nhãn “% hoàn thành”, khiến một giá trị khối lượng/tiến độ được hiểu thành trạng thái hoàn tất.

**Hướng xử lý:** ưu tiên trạng thái vận hành trong summary; đổi nhãn phần trăm thành “Tiến độ ghi nhận” hoặc “Khối lượng”; chỉ hiển thị “Hoàn thành” khi status roll-up cũng completed. Đây là thay đổi presentation/selector, chưa thay quy tắc DB trong PROMPT 01.

### P1 — Dashboard chờ widget chậm nhất

**Bằng chứng:** feedback skeleton `779 ms`, nội dung thật `3.147 s`; tab Thi công cần khoảng `5.4–5.6 s` để ổn định.

**Nguyên nhân Dashboard:** [`DashboardPage.tsx:15`](../src/features/foundation/pages/DashboardPage.tsx#L15) chờ toàn bộ `getDashboardReadModel`; service lại chờ `readSettingsGroup` rồi `Promise.allSettled` của mọi loader ([`dashboardService.ts:306-322`](../src/features/dashboard/services/dashboardService.ts#L306)). `Promise.allSettled` cô lập lỗi, nhưng không stream kết quả sớm; widget nhanh vẫn bị giữ đến khi widget chậm nhất xong.

**Hướng xử lý ở PROMPT 02:** giữ server shell/skeleton; tách critical summary khỏi các panel dưới fold, stream/Suspense hoặc fetch từng widget có cache và timeout riêng. Không quay lại một client fetch toàn dashboard sau hydrate.

### P1 — Card cá nhân bị kéo giãn và bố cục desktop không cân

**Bằng chứng:** ba card đầu desktop đều cao `471 px` dù “Ghi chú nhanh” có rất ít nội dung; card thứ tư rơi xuống hàng sau cao `363 px`.

**Nguyên nhân:** [`theme.css:619-620`](../src/app/theme.css#L619) dùng `align-items: stretch` và `height: 100%` cho mọi child; grid auto-fit tạo 3 cột tại chiều rộng content hiện tại.

**Hướng xử lý:** Personal Workbench dùng hai vùng có chủ đích: Action Inbox rộng và Personal Tools hẹp; card dùng `align-self:start`, chiều cao theo nội dung, có max-height + internal scroll cho danh sách dài.

### P1 — Lô hàng có thể lặp theo từng thiếu chứng từ

**Source verified:** [`dashboardService.ts:184-194`](../src/features/dashboard/services/dashboardService.ts#L184) dùng `flatMap(flags)` và tạo một `DashboardItem` cho mỗi flag với id `${shipment.id}:${flag.code}`.

**Điểm đã có:** [`attention.ts:13-33`](../src/features/dashboard/attention.ts#L13) gom Attention theo `href`, nên một lô có nhiều flag sẽ thành một dòng Attention.

**Điểm còn hở:** [`DashboardView.tsx:518`](../src/features/dashboard/components/DashboardView.tsx#L518) tạo `attentionIds` theo `type:id`; item đã gom giữ id của flag ưu tiên cao nhất. Khi render widget dưới, filter ở [`DashboardView.tsx:322`](../src/features/dashboard/components/DashboardView.tsx#L322) chỉ loại flag id đó; các flag khác của cùng lô vẫn có thể còn. Widget shipment tự thân cũng vẫn có nhiều row cùng shipment.

**Browser status:** role `test.supervisor` không được cấp widget shipment, nên không thể xác nhận danh sách lô trực tiếp bằng role này. “Lô hàng cần xử lý” đang thấy trong Inbox đến từ notification, không phải `shipment_attention`.

**Hướng xử lý:** chuẩn hóa item ngay tại loader thành một entity row/lô, `reasons[]` hoặc summary “3 vấn đề”, stable entity key `shipment:<shipmentId>`; dùng cùng entity key để loại lặp giữa Inbox, notification và panel phân hệ.

### P1 — Phê duyệt: không lặp exact item, vẫn có thể lặp theo ngữ nghĩa

- Loader tạo đúng một item cho mỗi approval case ([`dashboardService.ts:50-64`](../src/features/dashboard/services/dashboardService.ts#L50)).
- `attentionIds` + `excludedItems` loại exact `approval:<id>` khỏi section phê duyệt phía dưới. Đây là hành vi đúng và cần giữ.
- Notification nói về cùng đơn có type/id khác, nên vẫn có thể xuất hiện song song trong “Thông báo”. Cần dedupe theo `entityKey/deepLink`, không chỉ `type:id`.
- Role audit hiện không có widget `my_approvals`, vì vậy phần kiểm tra này là source-verified, browser-blocked theo permission.

### P1 — Khu “Hôm nay & 7 ngày” quá dài; task hierarchy yếu trên mobile

**Bằng chứng:** bảy ngày lặp “Khu QC03” và hai blocked items chiếm gần nửa trang mobile. Ba tên task đều bị cắt; task dài có `scrollWidth 261 > clientWidth 190`.

**Nguyên nhân:**

- Desktop dùng grid `7fr/3fr`; grid item mặc định stretch ([`PackageWorkspace.module.css:73-75`](../src/features/projects/components/package-workspace/PackageWorkspace.module.css#L73)).
- Ở `<=820px`, hai cột xếp dọc nhưng vẫn render đủ bảy ngày.
- `.taskName strong` ép `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` ([`PackageWorkspace.module.css:90`](../src/features/projects/components/package-workspace/PackageWorkspace.module.css#L90)).
- Mobile reset `padding-left:0` cho task name, làm depth cha/con mất tín hiệu thị giác ([`PackageWorkspace.module.css:280`](../src/features/projects/components/package-workspace/PackageWorkspace.module.css#L280)).

**Hướng xử lý:** desktop giữ rail phải nhưng chỉ mở “Hôm nay” + cảnh báo, sáu ngày sau collapse; mobile đặt “Hôm nay” trước backlog hoặc trong disclosure. Tên task cho phép 2 dòng; hierarchy dùng disclosure + connector/label phase rõ ràng.

### P2 — Danh sách gói đúng responsive nhưng thiếu dữ liệu ra quyết định

- Desktop một row trong canvas lớn tạo cảm giác rỗng; row không hiển thị quản lý dù search đã xét `projectManagerName`.
- Mobile card rõ, không tràn ngang, nhưng status badge absolute làm identity phải chừa cứng `124 px`; tên dài có nguy cơ tạo khoảng trắng bất thường.
- Filter/group là client-only sau fetch. Với dữ liệu lớn cần server pagination/filter; hiện chưa có bằng chứng dataset đủ lớn để coi là P1.
- Nút “Tạo gói” luôn render trong component; API vẫn chặn đúng bằng `project.create`. Cần truyền permission UI để không trình bày action mà người dùng không được phép, nhưng chưa kết luận role audit hiện tại thiếu quyền create.

### P2 — CSS có nhiều lớp override khó kiểm soát

`globals.css` có nhiều cụm `.dashboard-command-bar`, `.dashboard-personal-grid`, `.project-package-row`; `theme.css` tiếp tục override và được import sau `globals.css` ([`layout.tsx:8-9`](../src/app/layout.tsx#L8)). Điều này giải thích vì sao thay đổi cục bộ dễ không có hiệu lực hoặc tạo khác biệt giữa breakpoint.

Hướng triển khai sau audit: thay đổi trong CSS module/component scope của hai màn hình; không thêm một cụm global override mới, không đổi tokens/global shell.

## 6. Blueprint đề xuất

### 6.1 Project Workspace — desktop

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Danh sách gói     CT-2026-015 · Bảo trì ray Cảng ABC      [Đang thi công]│
│ Khu QC03 · Phạm Mai Anh · 5 nhân sự                 [Thông tin gói]        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Thi công              Chấm công              Hồ sơ              Tài liệu   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tiến độ ghi nhận 100%   2 vướng   1 đang thi công   Cập nhật gần nhất ... │
│ [Tìm công việc................................] [Trạng thái] [Cập nhật]    │
├───────────────────────────────────────────────┬─────────────────────────────┤
│ CÂY HẠNG MỤC / CÔNG VIỆC                     │ HÔM NAY                     │
│ ▾ Giai đoạn A        owner  hạn  %  trạng thái│ Khu QC03 · 3 người         │
│   ├─ Đầu việc A1     owner  hạn  %  [Vướng]  │ [Mở điểm danh/kế hoạch]    │
│   └─ Đầu việc A2     owner  hạn  %  [Đang]   ├─────────────────────────────┤
│ ▸ Giai đoạn B        owner  hạn  %  trạng thái│ VƯỚNG MẮC (2)              │
│                                               │ Entity rows, không lặp      │
│                                               ├─────────────────────────────┤
│                                               │ 6 ngày tiếp theo [Mở]       │
└───────────────────────────────────────────────┴─────────────────────────────┘
```

Nguyên tắc:

- Trạng thái đứng trước, phần trăm là dữ liệu bổ sung; không dùng `100% hoàn thành` nếu còn blocked/in-progress.
- Một toolbar cho search/filter/action; action theo permission.
- Cây task scan được, title tối đa hai dòng, có disclosure và depth rõ.
- Rail phải không stretch theo bảng; “6 ngày tiếp theo” collapse mặc định.

### 6.2 Project Workspace — mobile

```text
┌──────────────────────────────┐
│ ← Danh sách gói   [Đang]     │
│ CT-2026-015                  │
│ Bảo trì hệ thống ray...      │
│ Khu QC03 · PM · 5 người      │
│ [Thông tin gói]              │
├──────────────────────────────┤
│ Thi công | Chấm công | ...   │  <- sticky, scroll ngang nếu cần
├──────────────────────────────┤
│ 2 vướng · 1 đang thi công    │
│ Tiến độ ghi nhận 100%        │
│ [Tìm kiếm] [Bộ lọc]          │
├──────────────────────────────┤
│ ▾ Giai đoạn A                │
│   Đầu việc A1        [Vướng] │
│   Chủ trì · Hạn · 100%       │
│   [Cập nhật] [•••]           │
│   Đầu việc A2          [Đang]│
├──────────────────────────────┤
│ Hôm nay · Khu QC03 · 3 người │
│ Vướng mắc (2)                │
│ 6 ngày tiếp theo [Mở]        │
├──────────────────────────────┤
│ [Cập nhật hiện trường]       │  <- sticky CTA + safe-area
└──────────────────────────────┘
```

CTA chỉ sticky khi user có quyền và phải dành `padding-bottom` tương ứng; test overlap bằng account có `project_update.create` là gate bắt buộc trước khi chốt PROMPT 01.

### 6.3 Personal Workbench — desktop

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ GIỮ NGUYÊN: Chào + ngày                                                     │
│ GIỮ NGUYÊN: Ứng dụng của tôi (icon, thứ tự, permission)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tác vụ nhanh: [Tạo đơn nghỉ] [Điểm danh] [Cập nhật dự án]                  │
├───────────────┬───────────────┬───────────────┬─────────────────────────────┤
│ Cần xử lý 4   │ Vướng dự án 2 │ Chưa đọc 2    │ Công trường hôm nay QC03   │
├───────────────────────────────────────────────┬─────────────────────────────┤
│ ACTION INBOX                                  │ CÔNG CỤ CÁ NHÂN             │
│ Khẩn cấp                                      │ [Việc cá nhân] [Ghi chú]    │
│ • TEST-SHP-... · thiếu 3 chứng từ             │ nội dung cao theo content   │
│ • Đơn nghỉ ...                                │                             │
│ Theo dõi                                      │                             │
│ • Project issue ...                           │                             │
├───────────────────────────────────────────────┴─────────────────────────────┤
│ THEO PHÂN HỆ: entity rows gọn, không chart trang trí, không lặp Inbox      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Personal Workbench — mobile

```text
┌──────────────────────────────┐
│ GIỮ NGUYÊN: Chào + ngày      │
│ GIỮ NGUYÊN: Ứng dụng của tôi │
├──────────────────────────────┤
│ Tác vụ nhanh (2 cột/scroll)  │
├──────────────┬───────────────┤
│ Cần xử lý 4  │ Chưa đọc 2    │
│ Vướng 2      │ QC03 · 5 người│
├──────────────────────────────┤
│ ACTION INBOX                 │
│ Entity row, không lặp        │
│ ưu tiên -> trạng thái -> tuổi│
├──────────────────────────────┤
│ VIỆC CÁ NHÂN                 │
├──────────────────────────────┤
│ GHI CHÚ NHANH                │
├──────────────────────────────┤
│ Theo phân hệ [Mở rộng]       │
└──────────────────────────────┘
```

Không ẩn launcher/note theo profile trên mobile. Không đưa “Việc cần làm” lên trước greeting.

## 7. Component tree đề xuất

```text
ProjectPortfolioPage
└─ ProjectPortfolioWorkspace
   ├─ PortfolioToolbar
   └─ ProjectGroupList
      └─ ProjectEntityRow / ProjectEntityCard

PackageWorkspace
├─ EntityContextHeader                 (reuse)
├─ ContextTabs                         (reuse)
└─ ConstructionWorkbench
   ├─ ConstructionSummaryStrip
   ├─ ConstructionToolbar
   ├─ ProgressTree
   │  └─ ProgressTreeRow
   ├─ TodayRail
   │  ├─ TodayPlan
   │  ├─ BlockerEntityList
   │  └─ NextDaysDisclosure
   ├─ TaskEditorDrawer                 (preserve)
   └─ FieldUpdateDrawer + MobileCTA    (preserve)

DashboardView
├─ DashboardHeading                    (preserve)
├─ ModuleLauncher                      (preserve)
└─ PersonalWorkbench
   ├─ QuickActionBar
   ├─ DecisionMetricStrip              (exactly 4 contextual metrics)
   ├─ ActionInbox
   │  └─ EntityAttentionRow
   ├─ PersonalTools
   │  ├─ PersonalTodoWidget
   │  └─ PersonalNoteWidget
   └─ DomainBriefingList
      └─ CompactEntitySection
```

## 8. Thành phần/selector cần tái sử dụng

- Shared UI: `EntityContextHeader`, `ContextTabs`, `Button`, `StatusBadge`, `Drawer`, `SearchInput`, `Select`, `LoadingState`, `ErrorState`, `EmptyState`.
- Chuẩn compact data surface từ Kho: `ListPageLayout`, `DataSurface`, `FilterBar`, `DataTable` trong [`WarehouseListViews.tsx`](../src/features/warehouse/components/WarehouseListViews.tsx#L54). Chỉ tái sử dụng pattern/component; không sao chép raw CSS hoặc đổi module Kho.
- Project data: `listProjects`, `getProject`, `listProjectProgress`, `getProjectSchedule`, `projectSelect`, manager/worksite/people mapping.
- Dashboard data: `dashboardWidgetRegistry`, `enabledWidgetsFor`, `visibleQuickActions`, loaders hiện có, `normalizeAttention` sau khi chuyển sang entity key.
- Realtime: giữ `useDomainReconciliation("projects")` và `useDomainReconciliation("dashboard")`.
- Design system: tokens hiện có, spacing 4/8, Inter, touch target tối thiểu 44 px, status color semantic.

Không tiếp tục dùng như một API thiết kế mới:

- Các global selector dashboard/project bị lặp ở nhiều đoạn cuối file.
- `height:100%` trên mọi personal card.
- `nowrap + ellipsis` một dòng cho title task mobile.
- Một row dashboard cho mỗi flag của cùng entity.

## 9. Hành vi bắt buộc giữ nguyên

- URL hiện tại và legacy redirects.
- Auth, permission checks, RLS và scope dữ liệu.
- Thứ tự/icon/permission của “Ứng dụng của tôi”.
- AppShell, sidebar, desktop topbar và mobile topbar.
- CRUD project/task, quick update, drawer, upload, field update và idempotency hiện có.
- Tab visibility theo permission.
- Realtime reconciliation và retry/error isolation theo widget/section.
- Trạng thái loading/error/empty; skeleton không được nhấp nháy hoặc làm layout nhảy mạnh.
- Không mô tả nghiệp vụ dài dưới action/nav; UI chỉ giữ label, trạng thái và dữ liệu thao tác.

## 10. Verified, blocked và gate trước triển khai

### Verified

- Desktop/mobile không tràn ngang ở ba route chính.
- Không có hydration error/page error.
- Dashboard cards bị stretch; mobile supervisor ẩn launcher/note và đảo hierarchy.
- Project mobile task title bị cắt và mất depth rõ.
- Dữ liệu project 100% + in-progress/blocked là mâu thuẫn thật trên seed hiện tại.
- Shipment loader sinh item theo flag; Attention chỉ gom sau đó.
- Exact approval item có cơ chế loại lặp khỏi section dưới.
- Dashboard có skeleton nhưng content vẫn chờ toàn read model.

### Blocked / chưa đủ quyền hoặc dữ liệu

- Không mở được `/warehouse/receipts` bằng `test.supervisor`; chỉ đối chiếu source component chuẩn Kho.
- Không có role seed import-export/management để quan sát trực tiếp widget shipment và approval.
- Không render mobile field-update CTA với role audit, nên chưa xác minh được overlap trong trạng thái có quyền.
- Dataset project chỉ có một package và ba task; chưa thể đo virtualize/pagination ở tải lớn.
- WebSocket bị môi trường headless chặn, không dùng kết quả này để kết luận production realtime.

### Gate đề xuất cho PROMPT 01/02

1. Chốt cách gọi `100%`: “Tiến độ ghi nhận” hay công thức khác; không tự đổi quy tắc DB.
2. Cấp/seed một account có `project_update.create`, `shipment.view`, `approval.inbox.view`, `warehouse.view` để QA đầy đủ permission states.
3. Thống nhất rằng sửa mobile supervisor để hiện lại vùng top là correction nhằm giữ invariant, không phải redesign vùng top.
4. Mọi thay đổi sau đó phải có ảnh after cùng hai viewport và test không lặp entity.

## 11. Những gì PROMPT 00 không thay đổi

- Không sửa component UI hoặc CSS production.
- Không đổi global tokens, AppShell, header, sidebar.
- Không sửa auth/login, DB migration, RLS, Supabase hoặc realtime.
- Không đổi route, API contract, dữ liệu seed hay nghiệp vụ.
- Không triển khai blueprint; chờ duyệt trước khi chạy PROMPT 01.
