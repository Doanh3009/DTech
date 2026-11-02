-- Session checks lock tenant/account/session rows and may touch last_seen_at.
-- PostgREST runs STABLE RPCs in read-only transactions even for POST requests.
-- https://docs.postgrest.org/en/stable/references/transactions.html
do $$
declare rpc record;
begin
 for rpc in select p.oid::regprocedure signature from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'business_%' and p.prokind='f' and p.provolatile<>'v' and 'p_hash'=any(p.proargnames)
 loop
  execute format('alter function %s volatile',rpc.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
