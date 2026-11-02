import { createHash, randomUUID } from 'node:crypto';

export async function verifyBusinessMasterData(db, { registry, companies, credentials }) {
  const company = companies.find(row => row.industry === 'construction');
  const otherCompany = companies.find(row => row.industry === 'metalworking');
  const ownerHash = credentials[company.slug].ownerHash;
  const otherHash = credentials[otherCompany.slug].ownerHash;
  const tenant = (await db.query('select id,features from public.business_tenants where slug=$1', [company.slug])).rows[0];
  await db.query("update public.business_sessions set revoked_at=null,expires_at=now()+interval '1 hour' where token_hash=any($1::text[])", [[ownerHash, otherHash]]);
  const today = (await db.query("select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text today")).rows[0].today;
  const day = offset => { const result = new Date(`${today}T00:00:00Z`); result.setUTCDate(result.getUTCDate() + offset); return result.toISOString().slice(0, 10); };
  const dataFor = (kind, values) => ({ code: `MD-${randomUUID().slice(0, 12)}`, name: 'Synthetic unit conversion', notes: '', ...Object.fromEntries(Object.entries(registry[kind].fields).filter(([, field]) => !field.computed).map(([key, field]) => [key, values[key] ?? field.default ?? null])) });
  const save = async (kind, id, data, version = 0) => {
    const request = randomUUID();
    await db.query('select public.business_save_record($1,$2,$3,$4,$5,$6,$7,$8)', [ownerHash, company.slug, kind, id, version, data, request, createHash('sha256').update(JSON.stringify({ request, data })).digest('hex')]);
  };
  const create = async (kind, values) => { const id = randomUUID(); const data = dataFor(kind, values); await save(kind, id, data); return { id, data }; };
  const expectError = async (call, code) => { try { await call(); } catch (error) { if (String(error.message).includes(code)) return; throw error; } throw new Error(`Expected ${code}`); };
  const convert = async (itemId, unit, quantity, on, hash = ownerHash, slug = company.slug) => (await db.query('select public.business_item_quantity_conversion($1,$2,$3,$4,$5,$6) data', [hash, slug, itemId, unit, quantity, on])).rows[0].data;

  const item = await create('items', { unit: 'kg', tracking: 'none', standard_cost: 0 });
  await expectError(() => create('items', { unit: ' ', tracking: 'none', standard_cost: 0 }), 'BUSINESS_INVALID_INPUT');
  // An unused item can still be corrected before quantities depend on its base unit.
  await save('items', item.id, { ...item.data, unit: 'gram' }, 1);
  await save('items', item.id, item.data, 2);
  const previous = await create('item_unit_conversions', { item_id: item.id, alternate_unit: 'box', factor: 10, effective_from: day(-30), effective_to: day(-1) });
  const current = await create('item_unit_conversions', { item_id: item.id, alternate_unit: 'box', factor: 12, effective_from: today, effective_to: null });
  const historical = await convert(item.id, 'BOX', 2, day(-1));
  const present = await convert(item.id, ' box ', 2, today);
  const base = await convert(item.id, 'kg', 2, today);
  if (Number(historical.baseQuantity) !== 20 || historical.conversionId !== previous.id || Number(present.baseQuantity) !== 24 || present.conversionId !== current.id || base.conversionId !== null || Number(base.factor) !== 1) throw new Error('Effective-dated quantity conversion returned the wrong version or base quantity');
  await expectError(() => create('item_unit_conversions', { item_id: item.id, alternate_unit: 'BOX', factor: 13, effective_from: today, effective_to: day(3) }), 'BUSINESS_UOM_OVERLAP');
  await expectError(() => create('item_unit_conversions', { item_id: item.id, alternate_unit: 'bag', factor: 0, effective_from: today, effective_to: null }), 'BUSINESS_INVALID_INPUT');
  await expectError(() => create('item_unit_conversions', { item_id: item.id, alternate_unit: 'kg', factor: 1, effective_from: today, effective_to: null }), 'BUSINESS_INVALID_INPUT');
  await expectError(() => save('item_unit_conversions', current.id, { ...current.data, factor: 13 }, 1), 'BUSINESS_UOM_HISTORY_LOCKED');
  await expectError(() => save('items', item.id, { ...item.data, unit: 'tonne' }, 3), 'BUSINESS_ITEM_UNIT_LOCKED');
  await expectError(() => save('items', item.id, { ...item.data, unit: 'KG' }, 3), 'BUSINESS_ITEM_UNIT_LOCKED');
  await save('item_unit_conversions', current.id, { ...current.data, effective_to: today }, 1);
  await create('item_unit_conversions', { item_id: item.id, alternate_unit: 'box', factor: 14, effective_from: day(1), effective_to: null });
  if (Number((await convert(item.id, 'box', 2, today)).baseQuantity) !== 24 || Number((await convert(item.id, 'box', 2, day(1))).baseQuantity) !== 28) throw new Error('New unit conversion version overwrote its previous effective period');
  await expectError(() => convert(item.id, 'box', 2, day(-31)), 'BUSINESS_UOM_NOT_FOUND');
  await expectError(() => convert(item.id, 'box', 0, today), 'BUSINESS_INVALID_INPUT');
  await expectError(() => convert(item.id, 'box', 2, today, otherHash, otherCompany.slug), 'BUSINESS_NOT_FOUND');

  const serial = await create('items', { unit: 'piece', tracking: 'serial', standard_cost: 0 });
  await create('item_unit_conversions', { item_id: serial.id, alternate_unit: 'pack', factor: 1.5, effective_from: today, effective_to: null });
  await expectError(() => convert(serial.id, 'pack', 1, today), 'BUSINESS_UOM_SERIAL_QUANTITY');
  if (Number((await convert(serial.id, 'pack', 2, today)).baseQuantity) !== 3) throw new Error('Integral serial conversion was rejected or miscalculated');

  const referenced = (await db.query('select i.* from public.business_items i where i.tenant_id=$1 and exists(select 1 from public.business_stock_moves m where m.tenant_id=i.tenant_id and m.item_id=i.id) order by i.code limit 1', [tenant.id])).rows[0];
  if (!referenced) throw new Error('Master-data acceptance requires a seeded stock-move reference');
  const referencedData = { code: referenced.code, name: referenced.name, notes: referenced.notes, unit: `${referenced.unit}-changed`, tracking: referenced.tracking, standard_cost: Number(referenced.standard_cost) };
  await expectError(() => save('items', referenced.id, referencedData, referenced.row_version), 'BUSINESS_ITEM_UNIT_LOCKED');

  const limitedHash = createHash('sha256').update(randomUUID()).digest('hex');
  const limited = (await db.query("insert into public.business_accounts(tenant_id,username,display_name,password_hash,role,must_change_password) select $1,$2,'Synthetic unit viewer',password_hash,'viewer',false from public.business_accounts where tenant_id=$1 and role='owner' returning id,credential_version", [tenant.id, `md${randomUUID().replaceAll('-', '').slice(0, 12)}`])).rows[0];
  await db.query("insert into public.business_sessions(token_hash,tenant_id,account_id,credential_version,expires_at) values($1,$2,$3,$4,now()+interval '1 hour')", [limitedHash, tenant.id, limited.id, limited.credential_version]);
  await db.query('insert into public.business_access_profiles(tenant_id,account_id,custom_access) values($1,$2,true)', [tenant.id, limited.id]);
  await db.query("insert into public.business_access_grants(tenant_id,account_id,kind,actions,scope) values($1,$2,'items',array['read'],'tenant'),($1,$2,'item_unit_conversions',array['read'],'own')", [tenant.id, limited.id]);
  await expectError(() => convert(item.id, 'box', 2, today, limitedHash), 'BUSINESS_FORBIDDEN');
  await db.query("update public.business_access_grants set scope='tenant' where tenant_id=$1 and account_id=$2 and kind='item_unit_conversions'", [tenant.id, limited.id]);
  if (Number((await convert(item.id, 'box', 2, today, limitedHash)).baseQuantity) !== 24) throw new Error('Authorized conversion viewer could not read the conversion');
  await db.query("update public.business_tenants set features=features-'inventory' where id=$1", [tenant.id]);
  try { await expectError(() => convert(item.id, 'box', 2, today), 'BUSINESS_FORBIDDEN'); }
  finally { await db.query('update public.business_tenants set features=$2::jsonb where id=$1', [tenant.id, JSON.stringify(tenant.features)]); }
  const direct = (await db.query("select has_table_privilege('service_role','public.business_item_unit_conversions','SELECT') allowed")).rows[0].allowed;
  if (direct) throw new Error('Conversion table exposed direct service-role access');
  const privileges=(await db.query("select has_table_privilege('anon','public.business_notifications','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.business_notifications','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('service_role','public.business_notifications','SELECT,INSERT,UPDATE,DELETE') or has_function_privilege('anon','public.business_project_task_guard()','EXECUTE') or has_function_privilege('authenticated','public.business_project_task_guard()','EXECUTE') escaped")).rows[0];
  if(privileges.escaped)throw new Error('Supabase default grants escaped the notification/trigger RPC boundary');
  return { passed: true, checks: ['nonblank_base_unit', 'unused_base_unit_edit', 'referenced_base_unit_locked', 'effective_date_lookup', 'historical_factor_immutable', 'future_version_preserves_history', 'overlap_rejected', 'positive_factor', 'serial_integrality', 'tenant_isolation', 'row_scope', 'module_disabled', 'no_direct_table_access'], data: 'synthetic only', cloudAccess: false };
}
