import { loadTestConfiguration, reportTestingError } from "./config.mjs";

try {
  const { filename } = await loadTestConfiguration();
  console.log(`Cấu hình hợp lệ: ${filename}. Chỉ kiểm tra file; chưa kết nối database hoặc kiểm tra marker/server.`);
} catch (error) { reportTestingError(error); }
