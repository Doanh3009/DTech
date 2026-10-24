-- Recheck the session under a row lock after tenant/account locks. Logout must
-- win if it commits while a command is waiting for an account lock.
create or replace function public.business_assert_session(p_hash text,p_slug text,p_write boolean default false,p_allow_password_change boolean default false)
returns public.business_accounts language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype; t public.business_tenants%rowtype; s public.business_sessions%rowtype;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_slug is null then raise exception 'BUSINESS_SESSION_REQUIRED'; end if;
 select * into s from public.business_sessions where token_hash=p_hash;
 if not found or s.revoked_at is not null or s.expires_at<=now() or s.last_seen_at<=now()-interval '2 hours' then raise exception 'BUSINESS_SESSION_REQUIRED'; end if;
 select * into t from public.business_tenants where id=s.tenant_id and slug=p_slug
 and status in ('trial','active') and (status='active' or trial_ends_at>now()) for share;
 if not found then raise exception 'BUSINESS_TENANT_UNAVAILABLE'; end if;
 select * into a from public.business_accounts where tenant_id=t.id and id=s.account_id and status='active' for share;
 if not found then raise exception 'BUSINESS_SESSION_REQUIRED'; end if;
 select * into s from public.business_sessions where token_hash=p_hash and tenant_id=t.id and account_id=a.id for update;
 if not found or s.revoked_at is not null or s.expires_at<=now() or s.last_seen_at<=now()-interval '2 hours'
 or s.credential_version<>a.credential_version then raise exception 'BUSINESS_SESSION_REQUIRED'; end if;
 if a.must_change_password and not p_allow_password_change then raise exception 'BUSINESS_PASSWORD_CHANGE_REQUIRED'; end if;
 if p_write and a.role='viewer' then raise exception 'BUSINESS_FORBIDDEN'; end if;
 if s.last_seen_at<now()-interval '1 minute' then update public.business_sessions set last_seen_at=now() where token_hash=p_hash; end if;
 return a;
end $$;

-- Acquire the account exclusively before the shared session helper to avoid
-- two sessions upgrading shared locks while changing the same password.
create or replace function public.business_change_password(p_hash text,p_slug text,p_expected_version integer,p_password_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype; s public.business_sessions%rowtype;
begin
 if p_expected_version is null or p_expected_version<1 or p_password_hash is null
 or p_password_hash !~ '^scrypt\$65536\$8\$2\$[a-f0-9]{32}\$[a-f0-9]{128}$' then raise exception 'BUSINESS_INVALID_INPUT'; end if;
 select * into s from public.business_sessions where token_hash=p_hash;
 if not found then raise exception 'BUSINESS_SESSION_REQUIRED'; end if;
 perform 1 from public.business_tenants where id=s.tenant_id for share;
 select * into a from public.business_accounts where tenant_id=s.tenant_id and id=s.account_id for update;
 if not found then raise exception 'BUSINESS_SESSION_REQUIRED'; end if;
 a:=public.business_assert_session(p_hash,p_slug,false,true);
 if a.credential_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT'; end if;
 update public.business_accounts set password_hash=p_password_hash,must_change_password=false,credential_version=credential_version+1 where tenant_id=a.tenant_id and id=a.id;
 update public.business_sessions set revoked_at=now() where tenant_id=a.tenant_id and account_id=a.id and token_hash<>p_hash;
 update public.business_sessions set credential_version=a.credential_version+1 where token_hash=p_hash;
 insert into public.business_audit(tenant_id,actor_id,action) values(a.tenant_id,a.id,'password.changed');
 return jsonb_build_object('changed',true);
end $$;
revoke all on function public.business_assert_session(text,text,boolean,boolean) from public,anon,authenticated,service_role;
revoke all on function public.business_change_password(text,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.business_change_password(text,text,integer,text) to service_role;
