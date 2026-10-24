-- A cancelled invoice keeps its history and permits a replacement receivable.
drop index public.business_receivable_order_idx;
create unique index business_receivable_order_idx on public.business_receivables(tenant_id,sales_order_id) where sales_order_id is not null and status<>'cancelled';

do $$ declare f text;old text;begin
 -- Sales-only configurations retain operational receivables and payments.
 select pg_get_functiondef('public.business_record_action_core(text,text,text,uuid,integer,text,text,uuid,text)'::regprocedure) into f;
 old:='if total is null or total<=0 then raise exception ''BUSINESS_ORDER_EMPTY'';end if;';
 if strpos(f,old)=0 then raise exception 'Review sales command before upgrading';end if;
 f:=replace(f,old,old||E'\n   if not(t.features ? ''accounting'') then\n    insert into public.business_receivables(tenant_id,code,name,created_by,status,partner_id,sales_order_id,amount,due_date) values(a.tenant_id,public.business_next_number(a.tenant_id,''CN'',(v->>''order_date'')::date),''Công nợ ''||(v->>''name''),a.id,''posted'',(v->>''partner_id'')::uuid,p_id,total,(v->>''due_date'')::date);\n   end if;');execute f;
 select pg_get_functiondef('public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text)'::regprocedure) into f;
 old:='perform pg_advisory_xact_lock(hashtextextended(''business:''||a.tenant_id,0));';
 if strpos(f,old)=0 then raise exception 'Review financial command before upgrading';end if;
 f:=replace(f,old,old||E'\n if p_kind=''payments'' and not exists(select 1 from public.business_tenants where id=a.tenant_id and features ? ''accounting'') then return public.business_record_action_core(p_hash,p_slug,p_kind,p_id,p_expected_version,p_action,p_reason,p_request_id,p_payload_hash);end if;');execute f;
 -- Aggregated KPI values must not depend on the display row limit.
 select pg_get_functiondef('public.business_financial_snapshot(text,text,date,date,uuid)'::regprocedure) into f;
 old:='return jsonb_build_object(''trial'',trial,';
 if strpos(f,old)=0 then raise exception 'Review financial read model before upgrading';end if;
 f:=replace(f,old,E'totals:=totals||jsonb_build_object(''receivables'',(select coalesce(sum(amount-paid_amount),0) from public.business_receivables where tenant_id=a.tenant_id and status=''posted''),''payables'',(select coalesce(sum(amount-paid_amount),0) from public.business_payables where tenant_id=a.tenant_id and status=''posted''));\n '||old);execute f;
end $$;
