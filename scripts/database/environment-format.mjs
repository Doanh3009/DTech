import { parseEnv } from "node:util";

/** Discard JSON parser diagnostics: malformed stdin can contain a real secret. */
export function parseAdminCredentials(input) {
  let value;
  if (typeof input === "string") {
    try { value = JSON.parse(input); } catch { /* Return only the sanitized error below. */ }
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1
    || typeof value.password !== "string" || value.password.length < 8 || /[\x00-\x1f\x7f]/.test(value.password)) {
    throw new Error("Thông tin quản trị qua stdin không hợp lệ; cần JSON chỉ có password dạng chuỗi tối thiểu 8 ký tự, không có ký tự điều khiển.");
  }
  return { password: value.password };
}

/** Dotenv is not JSON: verify every encoded value with the runtime's parser. */
export function serializeEnvironment(entries) {
  return [...entries].map(([key, value]) => {
    if (typeof key !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error("Tên biến môi trường không hợp lệ.");
    if (typeof value !== "string" || /[\x00-\x1f\x7f]/.test(value)) throw new Error("Giá trị môi trường không hỗ trợ ký tự điều khiển hoặc xuống dòng.");
    // Single and backtick quotes preserve backslashes. Double quotes may expand
    // literal \\n, so only accept a representation after an exact roundtrip.
    const candidates = [value, `'${value}'`, `"${value}"`, `\`${value}\``];
    const encoded = candidates.find((candidate) => {
      const parsed = parseEnv(`${key}=${candidate}\n`);
      return Object.keys(parsed).length === 1 && parsed[key] === value;
    });
    if (encoded === undefined) throw new Error("Không thể lưu nguyên vẹn giá trị trong file .env; đổi giá trị để tránh kết hợp mọi dấu nháy với dấu # hoặc khoảng trắng đầu/cuối.");
    return `${key}=${encoded}`;
  }).join("\n") + "\n";
}
