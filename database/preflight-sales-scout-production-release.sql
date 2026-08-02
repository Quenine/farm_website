-- Read-only preflight for 20260802000100_sales_scout_production_release.sql.
begin transaction read only;
do $$
declare v_missing text[];
begin
  select array_agg(name) into v_missing from unnest(array[
    'marketing_campaigns','marketing_prospects','marketing_prospect_channels',
    'marketing_prospect_outreaches','marketing_prospect_activities',
    'marketing_sales_scout_campaigns','marketing_sales_scout_discovery_runs',
    'marketing_sales_scout_discovery_candidates','marketing_sales_scout_discovery_run_candidates'
  ]) name where to_regclass('public.'||name) is null;
  if v_missing is not null then raise exception 'missing prerequisite tables: %',v_missing; end if;
  if to_regprocedure('public.capture_sales_scout_candidate(jsonb,text,uuid,uuid)') is null or
     to_regprocedure('public.confirm_sales_scout_outreach_sent(uuid,text,text,timestamptz,uuid,text)') is null then
    raise exception 'Sales Scout prerequisite RPCs are missing';
  end if;
  if exists(select 1 from public.marketing_prospect_outreaches group by prospect_id,sequence_number having count(*)>1) then raise exception 'duplicate prospect outreach sequence must be reconciled before migration'; end if;
  if exists(select 1 from public.marketing_sales_scout_discovery_runs where status='running') then
    raise exception 'complete or fail running discovery runs before migration';
  end if;
end $$;
rollback;
