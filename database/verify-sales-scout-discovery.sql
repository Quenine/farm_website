begin;
select to_regclass('public.marketing_sales_scout_discovery_runs') is not null;
select to_regclass('public.marketing_sales_scout_discovery_candidates') is not null;
rollback;
