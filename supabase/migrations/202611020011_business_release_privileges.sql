-- Supabase grants explicit default privileges in addition to PUBLIC privileges.
-- Notifications are recipient-scoped through RPC; trigger functions have no direct API surface.
revoke all on table public.business_notifications from public,anon,authenticated,service_role;
revoke all on function public.business_project_task_guard() from public,anon,authenticated,service_role;
