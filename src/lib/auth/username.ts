export const usernamePattern = /^[a-z][a-z0-9._-]{2,31}$/;
export const usernameHtmlPattern = "[A-Za-z][A-Za-z0-9._\\-]{2,31}";

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function internalAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@accounts.chautuan.local`;
}
