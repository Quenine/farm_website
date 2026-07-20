-- Read-only Commercial Operations Batch 4.1 prospect activity verification.
select 'table' as report,
  case when to_regclass('public.marketing_prospect_activities') is null then 'missing' else 'present' end as detail
union all
select 'rls', coalesce((select relrowsecurity::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'marketing_prospect_activities'), 'missing')
union all
select 'prospect_occurred_index', case when exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'marketing_prospect_activities_prospect_occurred_idx') then 'present' else 'missing' end;
