create function public.business_entity_ledger_projection(p_actor uuid,p_kind text,v jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare journal jsonb;
begin
 if p_kind not in ('cash_vouchers','vendor_invoices','sales_invoices','supplier_payments','salary_runs','payments') or v ? 'posted_journal_id' then return v;end if;
 select to_jsonb(j) into journal from public.business_journal_entries j where tenant_id=(v->>'tenant_id')::uuid and source_kind=p_kind and source_id=(v->>'id')::uuid and status='posted' order by created_at desc,id limit 1;
 if journal is not null and public.business_access_allowed(p_actor,'journal_entries','read',journal) then return v||jsonb_build_object('posted_journal_id',journal->>'id');end if;return v;
end $$;
alter function public.business_record_detail(text,text,text,uuid) rename to business_record_detail_before_ledger;
alter function public.business_list_records(text,text,text,integer,text) rename to business_list_records_before_ledger;
revoke all on function public.business_record_detail_before_ledger(text,text,text,uuid),public.business_list_records_before_ledger(text,text,text,integer,text) from public,anon,authenticated,service_role;
create function public.business_record_detail(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;r jsonb;
begin a:=public.business_assert_session(p_hash,p_slug);r:=public.business_record_detail_before_ledger(p_hash,p_slug,p_kind,p_id);return public.business_entity_ledger_projection(a.id,p_kind,r);end $$;
create function public.business_list_records(p_hash text,p_slug text,p_kind text,p_page integer default 1,p_query text default '') returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;r jsonb;rows jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);r:=public.business_list_records_before_ledger(p_hash,p_slug,p_kind,p_page,p_query);
 select coalesce(jsonb_agg(public.business_entity_ledger_projection(a.id,p_kind,value) order by n),'[]'::jsonb) into rows from jsonb_array_elements(r->'records') with ordinality x(value,n);return jsonb_set(r,'{records}',rows);
end $$;

alter function public.business_document_export(text,text,text,uuid) rename to business_document_export_before_ledger;
revoke all on function public.business_document_export_before_ledger(text,text,text,uuid) from public,anon,authenticated,service_role;
create function public.business_document_export(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;r jsonb;header jsonb;document_journal_id uuid;d jsonb;lines jsonb;n integer;denied integer;
begin
 a:=public.business_assert_session(p_hash,p_slug);r:=public.business_document_export_before_ledger(p_hash,p_slug,p_kind,p_id);
 document_journal_id:=case when p_kind='journal_entries' then p_id else (r->'record'->>'posted_journal_id')::uuid end;
 if document_journal_id is null then return r;end if;
 d:=public.business_assert_kind(a.tenant_id,'journal_lines');select to_jsonb(j) into header from public.business_journal_entries j where tenant_id=a.tenant_id and id=document_journal_id;
 if not public.business_access_allowed(a.id,'journal_entries','read',header) or not public.business_access_allowed(a.id,'journal_entries','report',header) then return r;end if;
 select count(*),count(*) filter(where not public.business_access_allowed(a.id,'journal_lines','read',to_jsonb(l)) or not public.business_access_allowed(a.id,'journal_lines','report',to_jsonb(l))) into n,denied from public.business_journal_lines l where tenant_id=a.tenant_id and l.journal_id=document_journal_id and status='active';
 if denied>0 then if p_kind='journal_entries' then raise exception 'BUSINESS_SCOPED_REPORT';end if;return r;end if;
 if n>500 then raise exception 'BUSINESS_EXPORT_TOO_LARGE';end if;
 select coalesce(jsonb_agg(public.business_entity_redact_fields(to_jsonb(l),d,a.role)||jsonb_build_object('references',public.business_entity_reference_labels(a.id,'journal_lines',to_jsonb(l))) order by l.created_at,l.id),'[]'::jsonb) into lines from public.business_journal_lines l where tenant_id=a.tenant_id and l.journal_id=document_journal_id and status='active';
 return r||jsonb_build_object('journalLines',lines,'journalCode',header->>'code');
end $$;
revoke all on function public.business_entity_ledger_projection(uuid,text,jsonb),public.business_record_detail(text,text,text,uuid),public.business_list_records(text,text,text,integer,text),public.business_document_export(text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_record_detail(text,text,text,uuid),public.business_list_records(text,text,text,integer,text),public.business_document_export(text,text,text,uuid) to service_role;
notify pgrst,'reload schema';
