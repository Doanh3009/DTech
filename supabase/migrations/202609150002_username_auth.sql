-- Username-first authentication. Supabase Auth keeps an internal email identifier,
-- while application users authenticate with a simple, unique username.
alter table public.app_accounts add column if not exists username text;

update public.app_accounts
set username = 'user_' || left(replace(id::text, '-', ''), 8)
where username is null or btrim(username) = '';

update public.app_accounts set username = lower(btrim(username));

alter table public.app_accounts alter column username set not null;

create unique index if not exists app_accounts_username_ci_key
on public.app_accounts(lower(username));

do $$
begin
  alter table public.app_accounts
    add constraint app_accounts_username_format_check
    check (username ~ '^[a-z][a-z0-9._-]{2,31}$');
exception
  when duplicate_object then null;
end $$;
