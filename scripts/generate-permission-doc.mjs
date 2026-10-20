import {readFile,writeFile} from "node:fs/promises";
const source=await readFile(new URL("../src/lib/auth/permissions.ts",import.meta.url),"utf8");
const union=source.slice(source.indexOf("export type Permission"),source.indexOf("export type PermissionSet"));
const keys=[...union.matchAll(/\|\s*"([^"]+)"/g)].map(match=>match[1]);
const meanings={view:"Xem dữ liệu",manage:"Quản lý cấu hình/dữ liệu",create:"Tạo mới",edit:"Chỉnh sửa",archive:"Lưu trữ",disable:"Vô hiệu hóa",enable:"Kích hoạt",revoke:"Thu hồi",post:"Ghi sổ",reverse:"Đảo giao dịch",approve:"Phê duyệt",adjust:"Điều chỉnh",export:"Xuất dữ liệu",upload:"Tải tệp",replace:"Thay tệp",retry:"Thử lại",run:"Chạy tác vụ",access:"Truy cập"};
const lines=["# Permission catalog","","Generated từ `src/lib/auth/permissions.ts`; cập nhật bằng `node scripts/generate-permission-doc.mjs`. Quyền luôn được kiểm tra phía server; UI hide không phải security boundary.","","| Permission key | Ý nghĩa |","|---|---|"];
for(const key of keys){const parts=key.split(".");const action=parts.at(-1)||"view";lines.push(`| \`${key}\` | ${meanings[action]||"Thao tác nghiệp vụ"} — ${parts.slice(0,-1).join(" / ")} |`);}
lines.push("","Các quyền nhạy cảm cần explicit review trước go-live: `employee.view_sensitive`, `employee.export_sensitive`, `timesheet.unlock`, `warehouse.*.post`, `warehouse.*.reverse`, `import_export.view_all`, `api_key.*`, `service_account.manage`, `audit.view_sensitive`, `settings.manage`, `operations.run`.","");
await writeFile(new URL("../docs/security/permissions.md",import.meta.url),lines.join("\n"));
