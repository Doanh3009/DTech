// Captures successful local workflows; generated document references are resolved again at replay time.
import {writeFile} from 'node:fs/promises';
export function financeDemoSql(companies,{domain='finance'}={}){
 const commands=[],references=new Map();
 const quote=v=>`'${String(v).replaceAll("'","''")}'`;
 function value(v){
  if(v===null||v===undefined)return 'null';if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Invalid SQL number');return String(v);}
  if(typeof v==='boolean')return v?'true':'false';
  if(Array.isArray(v))return `array[${v.map(value).join(',')}]::text[]`;
  if(typeof v==='object'){
   let json=quote(JSON.stringify(v));
   for(const[key,item]of Object.entries(v))if(references.has(item))json=`jsonb_set(${json}::jsonb,${quote('{'+key+'}')},to_jsonb(${references.get(item)}))`;
   return json;
  }
  return quote(v);
 }
 return {
  query(sql,params){commands.push({sql,params:structuredClone(params)});},reference(id,sql){references.set(id,sql);},
  async write(filename){
   const slugs=companies.map(c=>quote(c.slug)).join(',');
   const duplicateGuard=domain==='crm'?`if exists(select 1 from public.business_leads where tenant_id in (select id from public.business_tenants where slug in (${slugs}))) then raise exception 'CRM demo already exists; preserve existing documents';end if;`:`if exists(select 1 from public.business_assets where tenant_id in (select id from public.business_tenants where slug in (${slugs}))) then raise exception 'Finance demo already exists; preserve existing documents';end if;
 if exists(select 1 from public.business_procurement_requests where tenant_id in (select id from public.business_tenants where slug in (${slugs}))) or exists(select 1 from public.business_shift_assignments where tenant_id in (select id from public.business_tenants where slug in (${slugs}))) then raise exception 'Operational demo already exists; preserve existing documents';end if;`;
   const header=`begin;
set local statement_timeout='90s';
set local standard_conforming_strings=on;
do $$ begin
 if (select count(*) from public.business_tenants where slug in (${slugs}) and is_demo)<>${companies.length} then raise exception 'Development demo tenants required';end if;
 ${duplicateGuard}
end $$;
`;
   await writeFile(filename,header+commands.map(({sql,params})=>sql.replace(/\$(\d+)\b/g,(_,n)=>value(params[Number(n)-1]))+';').join('\n')+'\ncommit;\n');
   return {commands:commands.length,companies:companies.length};
  }
 };
}
