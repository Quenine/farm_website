begin;
-- Run this only after migration 00400 in a non-production PostgreSQL project.
do $$ begin
 if to_regclass('public.marketing_sales_scout_discovery_runs') is null or to_regclass('public.marketing_sales_scout_discovery_candidates') is null or to_regclass('public.marketing_sales_scout_discovery_run_candidates') is null then raise exception 'Sales Scout discovery tables are missing'; end if;
 if not exists(select 1 from pg_class where oid='public.marketing_sales_scout_discovery_runs'::regclass and relrowsecurity) then raise exception 'discovery runs RLS is disabled'; end if;
 if not exists(select 1 from pg_class where oid='public.marketing_sales_scout_discovery_candidates'::regclass and relrowsecurity) then raise exception 'discovery candidates RLS is disabled'; end if;
 if not exists(select 1 from pg_class where oid='public.marketing_sales_scout_discovery_run_candidates'::regclass and relrowsecurity) then raise exception 'discovery membership RLS is disabled'; end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename in('marketing_sales_scout_discovery_runs','marketing_sales_scout_discovery_candidates','marketing_sales_scout_discovery_run_candidates')) then raise exception 'discovery table policy unexpectedly exists'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='marketing_sales_scout_discovery_runs_one_running_uidx') then raise exception 'one running run index is missing'; end if;
 if not exists(select 1 from pg_proc where oid='public.start_sales_scout_discovery_run(uuid,text[],integer,uuid)'::regprocedure and prosecdef) then raise exception 'start function security is invalid'; end if;
 if not exists(select 1 from pg_proc where oid='public.complete_sales_scout_discovery_run(uuid,jsonb,uuid)'::regprocedure and prosecdef) then raise exception 'completion function security is invalid'; end if;
 if not exists(select 1 from pg_proc where oid='public.fail_sales_scout_discovery_run(uuid,text,text,uuid)'::regprocedure and prosecdef) then raise exception 'failure function security is invalid'; end if;
end $$;
-- Behavioural coverage: execute synthetic fixture calls here after a non-production migration applies:
-- null actor rejection; inactive/missing-config rejection; one-running and UTC daily-limit enforcement;
-- completion validation/fingerprint replay; canonical rediscovery and run membership; captured/dismissed/reviewing preservation;
-- failure idempotence; and confirmation that no CRM prospect, outreach, or attribution is written.
rollback;