-- Confirmation belongs to one immutable, published version of the employee's payslip.
alter table public.payslips
  add column confirmed_at timestamptz,
  add column confirmed_by uuid references public.app_accounts(id) on delete restrict,
  add constraint payslips_confirmation_pair check ((confirmed_at is null) = (confirmed_by is null)),
  add constraint payslips_confirmation_published check (confirmed_at is null or published_at is not null);

create or replace function public.confirm_own_payslip(p_payslip_id uuid, p_version integer, p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_employee_id uuid;
  v_payslip public.payslips%rowtype;
  v_now timestamptz := now();
begin
  select employee_id into v_employee_id from public.app_accounts where id=p_actor_id and status='active';
  if v_employee_id is null then raise exception 'PAYSLIP_NOT_FOUND'; end if;
  select * into v_payslip from public.payslips
    where id=p_payslip_id and employee_id=v_employee_id for update;
  if not found then raise exception 'PAYSLIP_NOT_FOUND'; end if;
  if v_payslip.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_payslip.status<>'published' then raise exception 'PAYSLIP_NOT_PUBLISHED'; end if;
  if v_payslip.confirmed_at is null then
    update public.payslips set confirmed_at=v_now, confirmed_by=p_actor_id,
      viewed_at=coalesce(viewed_at,v_now) where id=p_payslip_id returning * into v_payslip;
    insert into public.audit_logs(actor_account_id,actor_employee_id,action,entity_type,entity_id,module,source,before_data,after_data)
      values(p_actor_id,v_employee_id,'payslip.confirmed','payslip',p_payslip_id::text,'accounting','web',
        jsonb_build_object('version',p_version,'confirmedAt',null),
        jsonb_build_object('version',p_version,'confirmedAt',v_now,'confirmedBy',p_actor_id));
  end if;
  return to_jsonb(v_payslip);
end $$;

-- Actor identity is supplied by the authenticated server, never by a browser RPC.
revoke all on function public.confirm_own_payslip(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.confirm_own_payslip(uuid,integer,uuid) to service_role;
