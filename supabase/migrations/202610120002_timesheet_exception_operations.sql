create or replace function public.resolve_timesheet_exception(p_exception_id uuid,p_actor_id uuid,p_status text,p_note text)
returns void language plpgsql security invoker set search_path=public as $$
declare v_period uuid; p timesheet_periods%rowtype; x timesheet_exceptions%rowtype;
begin
  if p_status not in ('resolved','ignored') or length(trim(coalesce(p_note,'')))<3 then raise exception 'RESOLUTION_REQUIRED'; end if;
  select period_id into v_period from timesheet_exceptions where id=p_exception_id;
  select * into p from timesheet_periods where id=v_period for update;
  if not found or p.status='locked' then raise exception 'PERIOD_LOCKED'; end if;
  select * into x from timesheet_exceptions where id=p_exception_id for update;
  if not found or x.status<>'open' then raise exception 'EXCEPTION_CONFLICT'; end if;
  update timesheet_exceptions set status=p_status,resolution_note=trim(p_note),resolved_by=p_actor_id,resolved_at=now() where id=x.id;
  update timesheet_periods set status='reviewing' where id=p.id;
end $$;
revoke all on function public.resolve_timesheet_exception(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.resolve_timesheet_exception(uuid,uuid,text,text) to service_role;
