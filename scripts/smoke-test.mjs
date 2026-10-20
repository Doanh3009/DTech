const base=(process.env.SMOKE_BASE_URL||"http://localhost:3000").replace(/\/$/,"");
const checks=[{path:"/api/health/live",statuses:[200]},{path:"/api/health/ready",statuses:[200,503]},{path:"/login",statuses:[200]}];
let failed=false;
for(const check of checks){try{const response=await fetch(base+check.path,{redirect:"manual",signal:AbortSignal.timeout(10000)});const requestId=response.headers.get("x-request-id");if(!check.statuses.includes(response.status))throw new Error(`HTTP ${response.status}`);console.log(`PASS ${check.path} ${response.status}${requestId?` request=${requestId}`:""}`);}catch(error){failed=true;console.error(`FAIL ${check.path}: ${error instanceof Error?error.message:String(error)}`);}}
if(failed)process.exit(1);
