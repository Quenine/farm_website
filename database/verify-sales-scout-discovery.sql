begin;

do $$
declare
  v_table text;
  v_function regprocedure;
begin
  foreach v_table in array array[
    'marketing_sales_scout_discovery_runs',
    'marketing_sales_scout_discovery_candidates',
    'marketing_sales_scout_discovery_run_candidates'
  ] loop
    if to_regclass('public.' || v_table) is null then raise exception 'missing discovery table %', v_table; end if;
    if not exists(select 1 from pg_class where oid=('public.' || v_table)::regclass and relrowsecurity) then raise exception 'RLS disabled for %', v_table; end if;
    if exists(select 1 from pg_policies where schemaname='public' and tablename=v_table) then raise exception 'unexpected policy for %', v_table; end if;
    foreach v_function in array array[
      'public.start_sales_scout_discovery_run(uuid,text[],integer,uuid)'::regprocedure,
      'public.complete_sales_scout_discovery_run(uuid,jsonb,uuid)'::regprocedure,
      'public.fail_sales_scout_discovery_run(uuid,text,text,uuid)'::regprocedure
    ] loop
      if not exists(select 1 from pg_proc where oid=v_function and prosecdef and proconfig @> array['search_path=public, pg_temp']) then raise exception 'insecure discovery function %',v_function; end if;
      if has_function_privilege('public',v_function,'execute') or has_function_privilege('anon',v_function,'execute') or has_function_privilege('authenticated',v_function,'execute') or not has_function_privilege('service_role',v_function,'execute') then raise exception 'incorrect function grants %',v_function; end if;
    end loop;
  end loop;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='marketing_sales_scout_discovery_runs_one_running_uidx') then raise exception 'missing running index'; end if;
end $$;

-- This rollback-only verifier intentionally uses no production records. Behavioural fixture assertions
-- are executed after a non-production application of migration 00400, then rolled back.
rollback;