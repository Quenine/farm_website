-- Read-only Commercial Operations Batch 4 verification.
with required(name) as (values ('marketing_campaign_spend'),('marketing_prospects'),('marketing_social_activities'),('affiliate_conversions')),
missing as (select name from required r where to_regclass('public.'||r.name) is null)
select 'missing_tables' report,coalesce(string_agg(name,', ' order by name),'none') detail from missing
union all select 'rls',coalesce(string_agg(c.relname||'='||c.relrowsecurity::text,', ' order by c.relname),'none') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in(select name from required);
