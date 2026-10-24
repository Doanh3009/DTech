import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
// Run against a local review server started with DTECH_CONTROL_CENTER_ENABLED=false.
const base="http://127.0.0.1:3101",checks=[];
const root=await fetch(base,{redirect:"manual"});assert.equal(root.status,307);assert.equal(new URL(root.headers.get("location"),base).pathname,"/login");checks.push({path:"/",status:root.status});
for(const path of ["/control-center/login","/control-center/customers","/control-center/trials","/dang-ky-dung-thu","/api/v1/crm/customers","/api/v1/trial-requests"]){const response=await fetch(base+path);assert.equal(response.status,404,path);checks.push({path,status:response.status});}
const post=await fetch(base+"/api/v1/trial-requests",{method:"POST",body:"invalid"});assert.equal(post.status,404);checks.push({path:"/api/v1/trial-requests",method:"POST",status:post.status});
const login=await fetch(base+"/login");assert.equal(login.status,200);assert(!(await login.text()).includes('href="/dang-ky-dung-thu"'));checks.push({path:"/login",status:login.status,noOperatorIntakeLink:true});
await writeFile("docs/commercial-erp/evidence/operator-crm-feature-off.json",JSON.stringify({generatedAt:new Date().toISOString(),passed:true,checks,createsCustomerInstance:false,readOnly:true,scope:"Local operator-feature flag only; not a two-database customer isolation rehearsal."},null,2));
console.log(JSON.stringify({passed:true,checks:checks.length,createsCustomerInstance:false}));
