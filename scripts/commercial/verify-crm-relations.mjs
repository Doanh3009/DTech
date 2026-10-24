import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const env=parseEnv(await readFile(".env.local","utf8"));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,"https://tcjjhxqtreemccdbvyza.supabase.co");
const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
for(const [table,fields]of [["product_trial_requests","request_id,qualification,customers:crm_customers(id)"],["crm_activities","id,actor:app_accounts(display_name)"]]){
 const {error,data}=await client.from(table).select(fields).limit(0).abortSignal(AbortSignal.timeout(10000));if(error)throw new Error(`CRM relation verification failed: ${table}`);assert.deepEqual(data,[]);
}
console.log(JSON.stringify({passed:true,readOnly:true,rowsRead:0,target:"tcjjhxqtreemccdbvyza",relationChecks:2}));
