import "server-only";

import { getServerEnv } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type HealthState = "healthy" | "degraded" | "unavailable" | "unknown";
export interface ComponentHealth { component: string; status: HealthState; latencyMs?: number; detail?: string; checkedAt: string }

async function timed<T>(work: () => PromiseLike<T>, timeoutMs=3000): Promise<{ value?: T; latencyMs: number; error?: string }> {
  const started=Date.now();
  try {
    const value=await Promise.race([Promise.resolve(work()),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("timeout")),timeoutMs))]);
    return {value,latencyMs:Date.now()-started};
  } catch (error) { return {latencyMs:Date.now()-started,error:error instanceof Error?error.message:"unknown"}; }
}

export async function databaseHealth(): Promise<ComponentHealth> {
  const checkedAt=new Date().toISOString(); const client=getSupabaseServiceClient();
  if(!client) return {component:"database",status:"unavailable",detail:"not_configured",checkedAt};
  const result=await timed(()=>client.from("system_settings").select("group_key",{head:true,count:"exact"}).limit(1));
  const response=result.value as {error?:{code?:string}}|undefined;
  return {component:"database",status:result.error||response?.error?"unavailable":"healthy",latencyMs:result.latencyMs,detail:result.error||response?.error?.code,checkedAt};
}

export async function publicReadiness() {
  const database=await databaseHealth();
  return {status:database.status==="healthy"?"ready":"not_ready",checks:[{component:database.component,status:database.status}],checkedAt:new Date().toISOString()};
}

export async function detailedSystemHealth() {
  const env=getServerEnv(); const client=getSupabaseServiceClient(); const database=await databaseHealth(); const checkedAt=new Date().toISOString();
  const components:ComponentHealth[]=[database];
  if(!client) components.push({component:"storage",status:"unavailable",detail:"not_configured",checkedAt});
  else {
    const storage=await timed(()=>client.storage.listBuckets()); const response=storage.value as {error?:{name?:string}}|undefined;
    components.push({component:"storage",status:storage.error||response?.error?"degraded":"healthy",latencyMs:storage.latencyMs,detail:storage.error||response?.error?.name,checkedAt});
  }
  components.push({component:"backup",status:env.BACKUP_LAST_VERIFIED_AT?"healthy":"unknown",detail:env.BACKUP_LAST_VERIFIED_AT||"no_verified_restore_evidence",checkedAt});
  return {release:{sha:env.RELEASE_SHA,environment:env.RELEASE_ENVIRONMENT},status:components.some(x=>x.status==="unavailable")?"degraded":components.every(x=>x.status==="healthy")?"healthy":"degraded",components,checkedAt};
}

export async function operationalJobs() {
  const client=getSupabaseServiceClient(); if(!client) return [];
  const [syncs,imports,exports,webhooks,operations]=await Promise.all([
    client.from("integration_sync_jobs").select("id,status,created_at,error_summary").order("created_at",{ascending:false}).limit(25),
    client.from("import_jobs").select("id,status,created_at,file_name").order("created_at",{ascending:false}).limit(25),
    client.from("report_exports").select("id,status,requested_at,error_message").order("requested_at",{ascending:false}).limit(25),
    client.from("webhook_deliveries").select("id,status,created_at,last_error").order("created_at",{ascending:false}).limit(25),
    client.from("operational_job_runs").select("id,status,started_at,error_code,job_key").order("started_at",{ascending:false}).limit(25)
  ]);
  const normalize=(kind:string,rows:unknown[]|null|undefined,timeKey:string,errorKey:string)=>(rows||[]).map(raw=>{const row=raw as Record<string,unknown>;return {id:String(row.id),kind,status:String(row.status),createdAt:String(row[timeKey]),error:row[errorKey]?String(row[errorKey]):undefined,label:row.job_key?String(row.job_key):row.file_name?String(row.file_name):kind};});
  return [...normalize("integration",syncs.data,"created_at","error_summary"),...normalize("import",imports.data,"created_at","error"),...normalize("report",exports.data,"requested_at","error_message"),...normalize("webhook",webhooks.data,"created_at","last_error"),...normalize("operation",operations.data,"started_at","error_code")].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);
}

export async function integrationHealth() {
  const client=getSupabaseServiceClient(); if(!client) return [];
  const {data}=await client.from("integration_configs").select("id,code,name,status,enabled,last_success_at,last_failure_at,consecutive_failures,last_error_code").order("name");
  return data||[];
}
