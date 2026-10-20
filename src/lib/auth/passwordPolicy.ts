export const ACCOUNT_PASSWORD_MIN_LENGTH = 8;
export const ACCOUNT_PASSWORD_PATTERN = /^.{8,}$/s;
export const ACCOUNT_PASSWORD_HTML_PATTERN = ".{8,}";
export const ACCOUNT_PASSWORD_MESSAGE = "Mật khẩu phải có tối thiểu 8 ký tự.";

export function isValidAccountPassword(value: string): boolean {
  return ACCOUNT_PASSWORD_PATTERN.test(value);
}
