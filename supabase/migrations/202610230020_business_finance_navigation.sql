-- Accounting owns financial navigation; sales-only packs retain their existing record permissions.
update public.business_entity_definitions set definition=definition||'{"workspaceFeature":"accounting"}'::jsonb where kind in ('receivables','payments');
