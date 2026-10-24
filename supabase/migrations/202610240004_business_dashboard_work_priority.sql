-- Put work requiring action before completed orders in the bounded dashboard list.
do $$ declare body text;anchor text:='jsonb_agg(to_jsonb(x) order by due_date,code)';begin
 select pg_get_functiondef('public.business_company_dashboard(text,text,date)'::regprocedure) into body;
 if strpos(body,anchor)=0 then raise exception 'Review company dashboard before upgrading';end if;
 body:=replace(body,anchor,'jsonb_agg(to_jsonb(x) order by (status=''released'') desc,due_date,code)');execute body;
end $$;
