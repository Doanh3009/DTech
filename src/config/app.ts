export const appConfig = {
  name: "Hệ thống nội bộ Châu Tuấn",
  shortName: "CHÂU TUẤN",
  companyName: "Châu Tuấn",
  timezone: process.env.APP_TIMEZONE ?? "Asia/Ho_Chi_Minh",
  locale: "vi-VN"
} as const;

export type AppConfig = typeof appConfig;
