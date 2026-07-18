-- Read-only operational notification verification.
with required_tables(name) as (values ('app_notifications'),('app_notification_reads'),('web_push_subscriptions'),('order_push_subscriptions')),
required_indexes(name) as (values ('app_notifications_site_created_idx'),('app_notifications_site_type_idx'),('app_notifications_site_dedupe_idx'),('app_notification_reads_admin_idx'),('web_push_subscriptions_site_context_idx'),('web_push_subscriptions_endpoint_hash_idx'),('order_push_subscriptions_order_idx'),('products_stock_alert_threshold_idx')),
missing_tables as (select name from required_tables r where not exists (select 1 from information_schema.tables t where t.table_schema='public' and t.table_name=r.name)),
missing_indexes as (select name from required_indexes r where not exists (select 1 from pg_indexes i where i.schemaname='public' and i.indexname=r.name)),
rls as (select c.relname, c.relrowsecurity, count(p.oid) policy_count from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_policy p on p.polrelid=c.oid where n.nspname='public' and c.relname in (select name from required_tables) group by c.relname,c.relrowsecurity)
select 'missing_tables' report, coalesce(string_agg(name, ', ' order by name),'none') detail from missing_tables
union all select 'missing_indexes', coalesce(string_agg(name, ', ' order by name),'none') from missing_indexes
union all select 'rls_and_policies', coalesce(string_agg(relname||': rls='||relrowsecurity::text||', policies='||policy_count::text, '; ' order by relname),'none') from rls
union all select 'product_alert_threshold', case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='stock_alert_threshold') then 'present' else 'missing' end;
