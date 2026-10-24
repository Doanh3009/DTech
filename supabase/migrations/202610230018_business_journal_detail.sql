create function public.business_journal_detail(p_hash text,p_slug text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;h public.business_journal_entries%rowtype;lines jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,'journal_entries');
 select * into h from public.business_journal_entries where tenant_id=a.tenant_id and id=p_id;if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'code',l.code,'name',l.name,'account',g.code,'accountName',g.name,'debit',l.debit,'credit',l.credit,'partner',p.name,'project',pr.name) order by l.created_at,l.code),'[]'::jsonb) into lines from public.business_journal_lines l join public.business_gl_accounts g on g.tenant_id=l.tenant_id and g.id=l.account_id left join public.business_tenant_partners p on p.tenant_id=l.tenant_id and p.id=l.partner_id left join public.business_projects pr on pr.tenant_id=l.tenant_id and pr.id=l.project_id where l.tenant_id=a.tenant_id and l.journal_id=p_id and l.status='active';
 return jsonb_build_object('rowVersion',h.row_version,'reviewedBy',h.reviewed_by,'lines',lines);
end $$;
revoke all on function public.business_journal_detail(text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_journal_detail(text,text,uuid) to service_role;
