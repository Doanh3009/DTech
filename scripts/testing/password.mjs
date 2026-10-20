export function getTestPassword(env = process.env) {
  const value = env.TEST_ACCOUNT_PASSWORD || env.SEED_TEST_PASSWORD;
  if (!value || value.length < 12) throw new Error("Configure TEST_ACCOUNT_PASSWORD or SEED_TEST_PASSWORD (minimum 12 characters) in private environment variables.");
  return value;
}
