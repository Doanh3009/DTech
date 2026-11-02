-- The registered entity is partners; business_entity_table resolves its tenant table.
update public.business_entity_definitions set definition=jsonb_set(definition,'{fields,partner_id,ref}','"partners"'::jsonb)
where kind='payment_requests';
