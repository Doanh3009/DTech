import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const packs=JSON.parse(await readFile("src/config/businessIndustries.json","utf8"));
const entities=JSON.parse(await readFile("src/config/businessEntities.json","utf8"));
const quote=s=>`'${String(s).replaceAll("'","''")}'`;
const ident=s=>{assert(/^[a-z_]+$/.test(s));return s;};
const sql=["-- Generated from businessIndustries.json and businessEntities.json; regenerate before this migration is applied."];
for(const [key,p]of Object.entries(packs))sql.push(`insert into public.business_industry_packs(key,label,features) values(${quote(key)},${quote(p.label)},${quote(JSON.stringify(p.features))}::jsonb);`);
for(const [kind,e]of Object.entries(entities)){
 ident(kind);sql.push(`insert into public.business_entity_definitions(kind,definition) values(${quote(kind)},${quote(JSON.stringify(e))}::jsonb);`);
 const fields=["id uuid primary key default gen_random_uuid()","tenant_id uuid not null references public.business_tenants(id)","code text not null check(char_length(code) between 1 and 50)","name text not null check(char_length(name) between 2 and 180)","notes text not null default '' check(char_length(notes)<=2000)",`status text not null default '${e.mode==='master'?'active':'draft'}' check(status in (${(e.mode==='master'?['active','inactive']:e.mode==='order'?['draft','released','completed','cancelled']:['draft','posted','cancelled']).map(quote).join(',')}))`,"row_version integer not null default 1 check(row_version>0)","created_by uuid not null","created_at timestamptz not null default now()","updated_at timestamptz not null default now()","unique(tenant_id,id)","foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id)"];
 for(const [field,f]of Object.entries(e.fields)){
  ident(field);let type=f.type==='number'?(f.integer?'integer':'numeric(20,4)'):f.type==='ref'?'uuid':f.type==='date'?'date':'text';
  let ddl=`${field} ${type}`;if(f.required||f.default!==undefined)ddl+=' not null';if(f.default!==undefined)ddl+=` default ${typeof f.default==='number'?f.default:quote(f.default)}`;
  if(f.type==='number')ddl+=` check(${field}>=${f.min??0} and ${field}<=${f.max??1e15})`;
  if(f.type==='enum')ddl+=` check(${field} in (${Object.keys(f.values).map(quote).join(',')}))`;
  if(['text','email'].includes(f.type))ddl+=` check(char_length(${field})<=${f.max??240})`;
  fields.push(ddl);
 }
 if(kind==='stock_moves')fields.push("source_kind text","source_id uuid","reversed_by uuid");
 if(kind==='work_orders')fields.push("bom_snapshot jsonb not null default '[]'::jsonb");
 if(kind==='lots')fields.push("check(expires_on is null or expires_on>=manufactured_on)");
 if(kind==='projects')fields.push("check(ends_on is null or ends_on>=starts_on)");
 if(kind==='quality_checks')fields.push("check(rejected_quantity<=checked_quantity)","check(result<>'passed' or rejected_quantity=0)");
 if(kind==='receivables')fields.push("check(paid_amount<=amount)");
 sql.push(`create table public.business_${kind}(\n ${fields.join(',\n ')}\n);`);
 sql.push(`create unique index business_${kind}_code_idx on public.business_${kind}(tenant_id,lower(code));\ncreate index business_${kind}_tenant_date_idx on public.business_${kind}(tenant_id,updated_at desc);\nalter table public.business_${kind} enable row level security;\nrevoke all on public.business_${kind} from public,anon,authenticated,service_role;`);
}
for(const [kind,e]of Object.entries(entities))for(const [field,f]of Object.entries(e.fields))if(f.type==='ref')sql.push(`alter table public.business_${ident(kind)} add foreign key(tenant_id,${ident(field)}) references public.business_${ident(f.ref)}(tenant_id,id);`);
sql.push("create unique index business_stock_source_idx on public.business_stock_moves(tenant_id,source_kind,source_id) where source_id is not null;\ncreate unique index business_operation_sequence_idx on public.business_operations(tenant_id,work_order_id,sequence);\ncreate unique index business_receivable_order_idx on public.business_receivables(tenant_id,sales_order_id) where sales_order_id is not null;\nalter table public.business_stock_moves add foreign key(tenant_id,reversed_by) references public.business_stock_moves(tenant_id,id);");
// The registry now spans forward migrations. Never overwrite migration history.
const output=path.resolve(process.argv[2]??".tmp/business-schema.generated.sql");
const relative=path.relative(process.cwd(),output);
assert(relative&&!relative.startsWith("..")&&!path.isAbsolute(relative)&&!relative.replaceAll("\\","/").startsWith("supabase/migrations/"),"Write generated reference DDL inside the workspace, outside migration history.");
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,sql.join('\n\n')+'\n');
console.log(JSON.stringify({tables:Object.keys(entities).length,industries:Object.keys(packs).length,output:relative,networkAccess:false}));
