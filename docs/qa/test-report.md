# Test report — 2026-09-14

Kết quả tự động được cập nhật từ lần chạy local/CI gần nhất; SHA cần ghi khi tạo evidence go-live.

| Gate | Trạng thái | Ghi chú |
|---|---|---|
| Migration validation | PASS | 16 ordered migrations |
| ESLint | PASS | 0 errors, 0 warnings |
| TypeScript strict | PASS | local 2026-09-14 |
| Vitest | PASS | 29 files, 127 tests |
| Production build | PASS | Next.js production build 2026-09-14 |
| Dependency audit | PASS WITH RISK | high threshold PASS; 2 moderate qua exceljs → uuid |
| Local production smoke | PASS WITH EXPECTED DEGRADATION | live 200, ready 503 do DB unavailable, login 200 |
| Deployed smoke | BLOCKED | chưa có staging URL |

Manual desktop/mobile/offline, performance với data production-like và business UAT chưa chạy. Không suy diễn PASS từ unit tests.
