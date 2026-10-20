import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, "").split("=");
  return [key, rest.join("=")];
}));
const requestedUsername = String(args.username || "").trim().toLowerCase();
const requestedDisplayName = String(args.name || "").trim();
const existingEmail = String(args["existing-email"] || "").trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || (!existingEmail && !requestedUsername) || !password || password.length < 8) {
  throw new Error("Cần Supabase URL/secret, --existing-email hoặc --username, và BOOTSTRAP_ADMIN_PASSWORD có tối thiểu 8 ký tự.");
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let accountQuery = client.from("app_accounts").select("id,auth_user_id,primary_email,username,display_name");
accountQuery = existingEmail
  ? accountQuery.eq("primary_email", existingEmail)
  : accountQuery.eq("username", requestedUsername);
const { data: existing, error: existingError } = await accountQuery.maybeSingle();
if (existingError) throw existingError;
const username = requestedUsername || String(existing?.username || "").trim().toLowerCase();
const displayName = requestedDisplayName || String(existing?.display_name || "").trim();
if (!displayName || !/^[a-z][a-z0-9._-]{2,31}$/.test(username)) {
  throw new Error("Tài khoản mới cần --username hợp lệ và --name; tài khoản hiện hữu phải có username và tên hiển thị hợp lệ.");
}

let authUserId = existing?.auth_user_id;
const internalEmail = existing?.primary_email || `${username}@accounts.chautuan.local`;
if (authUserId) {
  const { error } = await client.auth.admin.updateUserById(authUserId, {
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, username }
  });
  if (error) throw error;
} else {
  const { data, error } = await client.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, username }
  });
  if (error || !data.user) throw error || new Error("Không thể tạo Supabase Auth user.");
  authUserId = data.user.id;
}

const accountPayload = {
  auth_user_id: authUserId,
  username,
  display_name: displayName,
  primary_email: internalEmail,
  status: "active"
};
const accountResult = existing
  ? await client.from("app_accounts").update(accountPayload).eq("id", existing.id).select("id").single()
  : await client.from("app_accounts").insert(accountPayload).select("id").single();
if (accountResult.error || !accountResult.data) throw accountResult.error || new Error("Không thể tạo app account.");

const { data: role, error: roleError } = await client.from("roles").select("id").eq("code", "admin").single();
if (roleError || !role) throw roleError || new Error("Không tìm thấy vai trò admin.");
const { error: grantError } = await client.from("account_roles").upsert(
  { account_id: accountResult.data.id, role_id: role.id },
  { onConflict: "account_id,role_id" }
);
if (grantError) throw grantError;
console.log(`Admin '${username}' đã được cập nhật an toàn; không gửi email.`);
