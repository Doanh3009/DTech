create function public.business_owner_transfer_targets(p_hash text,p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.business_accounts%rowtype;targets jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'username',m.username) order by lower(m.display_name),m.id),'[]'::jsonb) into targets
 from public.business_accounts m where m.tenant_id=a.tenant_id and m.role='editor' and m.status='active' and not m.must_change_password and (m.access_expires_at is null or m.access_expires_at>now())
 and (m.staff_id is null or exists(select 1 from public.business_staff s where s.tenant_id=m.tenant_id and s.id=m.staff_id and s.status='active'));
 return jsonb_build_object('ownerVersion',a.management_version,'targets',targets);
end $$;

create function public.business_owner_transfer(p_hash text,p_slug text,p_request_id uuid,p_owner_version integer,p_target_id uuid,p_reason text,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;target public.business_accounts%rowtype;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);
 if p_request_id is not null then r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'owner.transfer',p_payload_hash);if r is not null then return r;end if;end if;
 if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 if p_request_id is null or p_target_id is null or p_target_id=a.id or p_owner_version is null or p_owner_version<1 or coalesce(char_length(btrim(p_reason)),0) not between 3 and 500 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into a from public.business_accounts where tenant_id=a.tenant_id and id=a.id for update;
 if not found or a.role<>'owner' or a.management_version<>p_owner_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 select * into target from public.business_accounts where tenant_id=a.tenant_id and id=p_target_id for update;
 if not found or target.role<>'editor' or target.status<>'active' or target.must_change_password or target.access_expires_at is not null and target.access_expires_at<=now() or target.staff_id is not null and not exists(select 1 from public.business_staff s where s.tenant_id=target.tenant_id and s.id=target.staff_id and s.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 update public.business_accounts set role='editor' where tenant_id=a.tenant_id and id=a.id;
 update public.business_accounts set role='owner' where tenant_id=a.tenant_id and id=target.id;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'owner.transferred','accounts',target.id,jsonb_build_object('previousOwnerId',a.id,'newOwnerId',target.id,'previousOwnerName',a.display_name,'newOwnerName',target.display_name,'reason',btrim(p_reason),'requestId',p_request_id));
 r:=jsonb_build_object('previousOwnerId',a.id,'ownerId',target.id,'rowVersion',a.management_version+1);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'owner.transfer',p_payload_hash,r);return r;
end $$;
revoke all on function public.business_owner_transfer_targets(text,text),public.business_owner_transfer(text,text,uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.business_owner_transfer_targets(text,text),public.business_owner_transfer(text,text,uuid,integer,uuid,text,text) to service_role;
