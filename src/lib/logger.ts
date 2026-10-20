import { getServerEnv } from "@/lib/env";

type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogContext {
  event?: string; requestId?: string; correlationId?: string; actorId?: string;
  entityType?: string; entityId?: string; route?: string; method?: string;
  status?: number; durationMs?: number; errorCode?: string; metadata?: Record<string, unknown>;
}

const sensitiveKeys = ["password","token","secret","authorization","cookie","service_role","national_id","bank_account","payload","body"];
const ranks: Record<LogLevel,number>={debug:10,info:20,warn:30,error:40};

export function sanitizeLogValue(value: unknown, depth=0): unknown {
  if (depth>5) return "[TRUNCATED]";
  if (typeof value==="string") return value.length>1000?`${value.slice(0,1000)}…`:value;
  if (!value || typeof value!=="object") return value;
  if (Array.isArray(value)) return value.slice(0,50).map(item=>sanitizeLogValue(item,depth+1));
  return Object.fromEntries(Object.entries(value as Record<string,unknown>).slice(0,100).map(([key,item])=>[
    key,sensitiveKeys.some(s=>key.toLowerCase().includes(s))?"[REDACTED]":sanitizeLogValue(item,depth+1)
  ]));
}

export function errorFingerprint(error: unknown): string {
  const name=error instanceof Error?error.name:"UnknownError";
  const message=error instanceof Error?error.message:String(error);
  let hash=2166136261;for(const character of name+":"+message){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return `err-${(hash>>>0).toString(16).padStart(8,"0")}`;
}

function write(level:LogLevel,message:string,context?:LogContext):void {
  let configured:LogLevel="info";
  try { configured=getServerEnv().LOG_LEVEL; } catch { /* startup logging must remain available */ }
  if(ranks[level]<ranks[configured]) return;
  const payload=sanitizeLogValue({level,message,timestamp:new Date().toISOString(),context});
  const serialized=JSON.stringify(payload);
  if(level==="error") console.error(serialized); else if(level==="warn") console.warn(serialized); else console.info(serialized);
}
export const logger={
  debug:(message:string,context?:LogContext)=>write("debug",message,context),
  info:(message:string,context?:LogContext)=>write("info",message,context),
  warn:(message:string,context?:LogContext)=>write("warn",message,context),
  error:(message:string,context?:LogContext)=>write("error",message,context)
};
