export const appConfig = {
  name: "DIMIXO ERP",
  shortName: "DIMIXO",
  companyName: "Doanh nghiệp",
  timezone: process.env.APP_TIMEZONE ?? "Asia/Ho_Chi_Minh",
  locale: "vi-VN"
} as const;

export type AppConfig = typeof appConfig;
