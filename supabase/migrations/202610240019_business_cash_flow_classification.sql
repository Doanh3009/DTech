-- Preserve separately paid fees in a compound cash journal; remove only the part
-- that cannot be explained by a non-cash counter-entry (internal cash transfers).
do $$ declare body text;anchor text;replacement text;begin
 select pg_get_functiondef('public.business_company_dashboard(text,text,date)'::regprocedure) into body;
 anchor:='select id,posting_date,sum(debit-credit) delta from lines';
 if strpos(body,anchor)=0 then raise exception 'Review cash flow dashboard before upgrading';end if;
 replacement:=$r$select id,posting_date,
   least(sum(case when code like '111%' or code like '112%' then debit else 0 end),sum(case when code not like '111%' and code not like '112%' then credit else 0 end)) cash_in,
   least(sum(case when code like '111%' or code like '112%' then credit else 0 end),sum(case when code not like '111%' and code not like '112%' then debit else 0 end)) cash_out
   from lines where document_type<>'opening' and source_kind is distinct from 'closing_runs' group by id,posting_date$r$;
 body:=regexp_replace(body,'select id,posting_date,sum\(debit-credit\) delta from lines[^\n]*',replacement);
 body:=replace(replace(body,'sum(greatest(delta,0))','sum(cash_in)'),'sum(greatest(-delta,0))','sum(cash_out)');
 anchor:='sum(case when g.code like ''111%'' or g.code like ''112%'' then l.debit-l.credit else 0 end) cash,';
 if strpos(body,anchor)=0 then raise exception 'Review cash trend before upgrading';end if;
 body:=replace(body,anchor,$r$sum(case when g.code like '111%' or g.code like '112%' then l.debit else 0 end) cash_debit,
    sum(case when g.code like '111%' or g.code like '112%' then l.credit else 0 end) cash_credit,
    sum(case when g.code not like '111%' and g.code not like '112%' then l.debit else 0 end) other_debit,
    sum(case when g.code not like '111%' and g.code not like '112%' then l.credit else 0 end) other_credit,$r$);
 body:=replace(replace(body,'sum(greatest(j.cash,0))','sum(least(j.cash_debit,j.other_credit))'),'sum(greatest(-j.cash,0))','sum(least(j.cash_credit,j.other_debit))');execute body;
end $$;
