import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomBytes,randomUUID,scryptSync} from 'node:crypto';
const target=JSON.parse(await readFile('supabase/deployments/dtech-erp.json','utf8'));
if(target.projectRef!=='tcjjhxqtreemccdbvyza'||target.application.environment!=='development'||target.protectedExistingProjectRefs.includes(target.projectRef))throw Error('Development target mismatch');
const companies=JSON.parse(await readFile('src/config/businessDemoCompanies.json','utf8'));
const access=JSON.parse(await readFile('.tmp/dimixo-experience-credentials.json','utf8'));
const people=[['Trần Thanh Tú','thanhtu'],['Lê Thu Trang','thutrang'],['Hoàng Anh Dũng','anhdung'],['Bùi Ngọc Mai','ngocmai'],['Vũ Tuấn Kiệt','tuankiet'],['Đỗ Minh Đức','minhduc']];
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
let sql="begin;set local statement_timeout='30s';\n";
let guide=await readFile('.tmp/DIMIXO-tai-khoan-trai-nghiem.md','utf8');
for(const [i,c] of companies.entries()){
 if(!access[c.slug].viewer){const salt=randomBytes(16);const password=`Dx!${randomBytes(12).toString('base64url')}7a`;const raw=createHash('md5').update(`dimixo:experience:viewer:${c.slug}`).digest('hex');access[c.slug].viewer={name:people[i][0],username:people[i][1],accountId:`${raw.slice(0,8)}-${raw.slice(8,12)}-4${raw.slice(13,16)}-a${raw.slice(17,20)}-${raw.slice(20)}`,requestId:randomUUID(),password,passwordHash:`scrypt$65536$8$2$${salt.toString('hex')}$${scryptSync(password,salt,64,{N:65536,r:8,p:2,maxmem:128*1024*1024}).toString('hex')}`};}
 const a=access[c.slug].viewer;
 sql+=`do $$ declare t public.business_tenants%rowtype;actor uuid;begin
 select * into t from public.business_tenants where slug=${q(c.slug)} and is_demo;if not found then raise exception 'Experience tenant required';end if;
 if exists(select 1 from public.business_accounts where id=${q(a.accountId)}) then
  if not exists(select 1 from public.business_accounts where tenant_id=t.id and id=${q(a.accountId)} and username=${q(a.username)} and role='viewer') then raise exception 'Reserved account changed';end if;
 else
  select a.id into actor from public.app_accounts a where a.status='active' and exists(select 1 from public.account_roles ar join public.roles r on r.id=ar.role_id where ar.account_id=a.id and r.code='admin') order by a.created_at limit 1;
  if actor is null then raise exception 'Operator admin required';end if;
  perform public.business_operator_account_command(${q(a.requestId)},t.customer_id,t.row_version,'create',${q(a.accountId)},${q(JSON.stringify({username:a.username,displayName:a.name,role:'viewer'}))}::jsonb,${q(a.passwordHash)},actor);
  -- Only newly seeded synthetic identities are made ready without a password-change step.
  update public.business_accounts set must_change_password=false where tenant_id=t.id and id=${q(a.accountId)};
  insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id) values(t.id,actor,'experience.account.ready','business_accounts',${q(a.accountId)});
 end if;
end $$;\n`;
 const note=`- Chỉ xem: \`${a.username}\` · ${a.name}\n- Mật khẩu tài khoản chỉ xem: \`${a.password}\`\n`;
 if(!guide.includes(`Chỉ xem: \`${a.username}\``))guide=guide.replace(`## ${c.name}\n\n`,`## ${c.name}\n\n${note}`);
}
sql+='commit;\n';
await writeFile('.tmp/dimixo-viewers.sql',sql);await writeFile('.tmp/dimixo-experience-credentials.json',JSON.stringify(access,null,2));await writeFile('.tmp/DIMIXO-tai-khoan-trai-nghiem.md',guide);
console.log(JSON.stringify({target:target.projectRef,viewerAccounts:companies.length,applied:false,credentialsPrinted:false}));
