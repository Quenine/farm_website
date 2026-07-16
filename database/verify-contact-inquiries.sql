-- Safe read-only contact inquiry verification.
select 'table_exists' as check_name, exists(select 1 from information_schema.tables where table_schema='public' and table_name='contact_inquiries')::text as result
union all select 'rls_enabled', coalesce((select relrowsecurity::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='contact_inquiries'), 'false')
union all select 'status_index', exists(select 1 from pg_indexes where schemaname='public' and indexname='contact_inquiries_status_idx')::text
union all select 'created_index', exists(select 1 from pg_indexes where schemaname='public' and indexname='contact_inquiries_created_at_idx')::text;
