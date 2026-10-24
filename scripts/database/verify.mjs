import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { assertDeploymentEnvironment, assertExplicitInstanceFiles, deploymentArguments, deploymentEnvironment, loadDeploymentManifest, settingsPreview } from "./deployment-manifest.mjs";

const args = deploymentArguments();
assertExplicitInstanceFiles(args);
const { target } = await loadDeploymentManifest(args.manifest);
const env = await deploymentEnvironment(args["environment-file"]);
assertDeploymentEnvironment(target, env);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(target.apiUrl, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, options);
const anonymous = createClient(target.apiUrl, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const counts = {};
for (const table of ["permissions", "roles", "employees", "app_accounts", "projects", "inventory_items", "warehouses", "import_contract_number_sequences", "inventory_number_sequences", "shipment_number_sequences", "stock_count_number_sequences"]) {
  const { count, error } = await service.from(table).select("*", { head: true, count: "exact" });
  if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
  counts[table] = count;
}
const { data: settings, error: settingsError } = await service.from("system_settings").select("group_key,value").in("group_key", ["branding", "organization", "modules"]);
if (settingsError) throw settingsError;
const configuration = Object.fromEntries(settings.map((row) => [row.group_key, row.value]));
const expected = settingsPreview(target);
assert.equal(configuration.branding?.systemName, expected.branding.systemName);
assert.equal(configuration.organization?.companyName, expected.organization.companyName);
assert.equal(configuration.organization?.shortName, expected.organization.shortName);
for (const [key, value] of Object.entries(expected.modules)) assert.equal(configuration.modules?.[key], value, `Cấu hình module ${key} khác manifest.`);
const { data: buckets, error: bucketError } = await service.storage.listBuckets();
if (bucketError) throw bucketError;
const { data: visibleAccounts, error: anonymousError } = await anonymous.from("app_accounts").select("id").limit(1);
assert(anonymousError || visibleAccounts.length === 0, "Người chưa đăng nhập không được đọc tài khoản.");
for (const table of ["import_contract_number_sequences", "inventory_number_sequences", "shipment_number_sequences", "stock_count_number_sequences"]) {
  const { error } = await anonymous.from(table).select("*").limit(1);
  assert(error, `Người chưa đăng nhập không được truy cập bộ đếm ${table}.`);
}
const { data: auth, error: authError } = await service.auth.admin.listUsers({ page: 1, perPage: 1 });
if (authError) throw authError;
console.log(JSON.stringify({ projectRef: target.projectRef, databaseConnected: true, configurationSaved: true, anonymousAccountsProtected: true, authUsersPresent: auth.users.length > 0, counts, buckets: buckets.map(({ id, public: isPublic }) => ({ id, public: isPublic })) }, null, 2));
