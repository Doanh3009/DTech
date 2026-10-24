create function public.business_workflow_workspace(p_hash text,p_slug text,p_view text,p_page integer default 1,p_request_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;rows jsonb;totals jsonb;lines jsonb:='[]';quotes jsonb:='[]';total bigint;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 if p_page is null or p_page not between 1 and 100000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_view='procurement' then
  perform public.business_assert_kind(a.tenant_id,'procurement_requests');perform public.business_assert_report_access(a.id,array['purchasing','inventory']);
  with request_rows as (
   select r.id,r.code,r.name,r.status,r.needed_on,p.name project,r.total_amount estimated,
    (select count(*) from public.business_procurement_request_lines where tenant_id=r.tenant_id and request_id=r.id and status='active') line_count,
    (select count(*) from public.business_supplier_quotes where tenant_id=r.tenant_id and request_id=r.id and status='posted') quote_count,
    coalesce((select sum(h.total_amount) from public.business_procurement_awards h join public.business_supplier_quotes q on q.tenant_id=h.tenant_id and q.id=h.quote_id where h.tenant_id=r.tenant_id and q.request_id=r.id and h.status='posted'),0) ordered,
    (select count(*) from public.business_procurement_request_lines l where l.tenant_id=r.tenant_id and l.request_id=r.id and l.status='active' and l.quantity>coalesce((select sum(x.quantity) from public.business_procurement_award_lines x join public.business_procurement_awards h on h.tenant_id=x.tenant_id and h.id=x.award_id and h.status='posted' join public.business_supplier_quote_lines q on q.tenant_id=x.tenant_id and q.id=x.quote_line_id where x.tenant_id=l.tenant_id and q.request_line_id=l.id and x.status='active'),0)) open_lines
   from public.business_procurement_requests r left join public.business_projects p on p.tenant_id=r.tenant_id and p.id=r.project_id where r.tenant_id=a.tenant_id and r.status<>'cancelled'
  ) select count(*),jsonb_build_object('requests',count(*),'estimated',coalesce(sum(estimated),0),'ordered',coalesce(sum(ordered),0),'pendingLines',coalesce(sum(open_lines),0)),coalesce((select jsonb_agg(to_jsonb(x)) from (select * from request_rows order by needed_on,code limit 25 offset (p_page-1)*25)x),'[]') into total,totals,rows from request_rows;
  if p_request_id is not null then
   if not exists(select 1 from public.business_procurement_requests where tenant_id=a.tenant_id and id=p_request_id) then raise exception 'BUSINESS_NOT_FOUND';end if;
   select coalesce(jsonb_agg(to_jsonb(x) order by code),'[]') into lines from (
    select l.id,l.code,l.name,i.name item,i.unit,l.quantity requested,l.estimated_price,
     coalesce((select sum(d.quantity) from public.business_procurement_award_lines d join public.business_procurement_awards h on h.tenant_id=d.tenant_id and h.id=d.award_id and h.status='posted' join public.business_supplier_quote_lines q on q.tenant_id=d.tenant_id and q.id=d.quote_line_id where d.tenant_id=l.tenant_id and q.request_line_id=l.id and d.status='active'),0) ordered
    from public.business_procurement_request_lines l join public.business_items i on i.tenant_id=l.tenant_id and i.id=l.item_id where l.tenant_id=a.tenant_id and l.request_id=p_request_id and l.status='active'
   )x;
   select coalesce(jsonb_agg(to_jsonb(x) order by comparable_value nulls last,code),'[]') into quotes from (
    select q.id,q.code,q.name,s.name supplier,q.valid_until,q.delivery_on,q.payment_terms,q.total_amount quoted_value,
     case when q.status='posted' and not exists(select 1 from public.business_procurement_request_lines r where r.tenant_id=q.tenant_id and r.request_id=q.request_id and r.status='active' and r.quantity>coalesce((select sum(quantity) from public.business_supplier_quote_lines where tenant_id=q.tenant_id and quote_id=q.id and request_line_id=r.id and status='active'),0)) then q.total_amount end comparable_value,
     q.status,case when q.valid_until<(now() at time zone 'Asia/Ho_Chi_Minh')::date then 'expired' else 'valid' end validity
    from public.business_supplier_quotes q join public.business_tenant_partners s on s.tenant_id=q.tenant_id and s.id=q.partner_id where q.tenant_id=a.tenant_id and q.request_id=p_request_id and q.status<>'cancelled'
   )x;
  end if;
 elsif p_view='projects' then
  perform public.business_assert_kind(a.tenant_id,'projects');perform public.business_assert_report_access(a.id,array['projects','purchasing','costing','accounting','people']);
  with project_rows as (
   select p.id,p.code,p.name,p.operational_state,p.ends_on,
    (b->>'revision')::integer revision,(b->>'limit')::numeric budget,(b->>'commitments')::numeric procurement_exposure,(b->>'otherActual')::numeric other_costs,(b->>'remaining')::numeric remaining,
    (select coalesce(sum(amount),0) from public.business_project_acceptances where tenant_id=p.tenant_id and project_id=p.id and status='posted') accepted,
    (select coalesce(sum(amount),0) from public.business_acceptance_billings where tenant_id=p.tenant_id and project_id=p.id and status='posted') billed
   from public.business_projects p cross join lateral public.business_project_budget(p.tenant_id,p.id) b where p.tenant_id=a.tenant_id and p.status='active'
  ) select count(*),jsonb_build_object('projects',count(*),'budget',coalesce(sum(budget),0),'exposure',coalesce(sum(procurement_exposure+other_costs),0),'remaining',coalesce(sum(remaining),0),'accepted',coalesce(sum(accepted),0),'billed',coalesce(sum(billed),0)),coalesce((select jsonb_agg(to_jsonb(x)) from (select * from project_rows order by ends_on,code limit 25 offset (p_page-1)*25)x),'[]') into total,totals,rows from project_rows;
 else raise exception 'BUSINESS_INVALID_INPUT';end if;
 return jsonb_build_object('rows',rows,'total',total,'totals',totals,'lines',lines,'quotes',quotes,'page',p_page,'pageSize',25);
end $$;
revoke all on function public.business_workflow_workspace(text,text,text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_workflow_workspace(text,text,text,integer,uuid) to service_role;
