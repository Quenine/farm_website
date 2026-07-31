begin;

-- Batch 5A-M2: execute only after 00400 has been applied, always in a disposable transaction.
do $$
declare
  v_table text;
  v_column text;
  v_function regprocedure;
  v_actor uuid := gen_random_uuid();
  v_active uuid := gen_random_uuid();
  v_inactive uuid := gen_random_uuid();
  v_missing uuid := gen_random_uuid();
  v_daily uuid := gen_random_uuid();
  v_rediscovery uuid := gen_random_uuid();
  v_failure uuid := gen_random_uuid();
  v_exact_prospect uuid := gen_random_uuid();
  v_later_prospect uuid := gen_random_uuid();
  v_run uuid;
  v_run_two uuid;
  v_result jsonb;
  v_payload jsonb;
  v_before_prospects integer;
  v_before_outreaches integer;
  v_before_attributions integer;
  v_before_candidates integer;
  v_before_memberships integer;
  v_seen integer;
  v_first_run uuid;
  v_last_seen timestamptz;
begin
  -- Structure, constraints, indexes, RLS, direct grants, and function security.
  foreach v_column in array array['discovery_latitude','discovery_longitude','discovery_radius_km','discovery_default_limit'] loop
    if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='marketing_sales_scout_campaigns' and column_name=v_column) then raise exception 'missing campaign discovery column %',v_column; end if;
  end loop;
  if (select count(*) from pg_constraint where conrelid='public.marketing_sales_scout_campaigns'::regclass and conname in ('marketing_sales_scout_campaigns_discovery_latitude_check','marketing_sales_scout_campaigns_discovery_longitude_check','marketing_sales_scout_campaigns_discovery_radius_check','marketing_sales_scout_campaigns_discovery_limit_check'))<>4 then raise exception 'scoped discovery constraints missing'; end if;
  foreach v_table in array array['marketing_sales_scout_discovery_runs','marketing_sales_scout_discovery_candidates','marketing_sales_scout_discovery_run_candidates'] loop
    if to_regclass('public.'||v_table) is null then raise exception 'missing discovery table %',v_table; end if;
    if not exists(select 1 from pg_class where oid=('public.'||v_table)::regclass and relrowsecurity) then raise exception 'RLS disabled for %',v_table; end if;
    if exists(select 1 from pg_policies where schemaname='public' and tablename=v_table) then raise exception 'unexpected browser policy for %',v_table; end if;
    foreach v_column in array array['select','insert','update','delete'] loop
      if has_table_privilege('public','public.'||v_table,v_column) or has_table_privilege('anon','public.'||v_table,v_column) or has_table_privilege('authenticated','public.'||v_table,v_column) or not has_table_privilege('service_role','public.'||v_table,v_column) then raise exception 'table privilege failure %, %',v_table,v_column; end if;
    end loop;
  end loop;
  foreach v_function in array array['public.start_sales_scout_discovery_run(uuid,text[],integer,uuid)'::regprocedure,'public.complete_sales_scout_discovery_run(uuid,jsonb,uuid)'::regprocedure,'public.fail_sales_scout_discovery_run(uuid,text,text,uuid)'::regprocedure] loop
    if not exists(select 1 from pg_proc where oid=v_function and prosecdef and proconfig @> array['search_path=public, pg_temp']) then raise exception 'function security failure %',v_function; end if;
    if has_function_privilege('public',v_function,'execute') or has_function_privilege('anon',v_function,'execute') or has_function_privilege('authenticated',v_function,'execute') or not has_function_privilege('service_role',v_function,'execute') then raise exception 'function grant failure %',v_function; end if;
  end loop;
  foreach v_table in array array['marketing_sales_scout_discovery_runs_one_running_uidx','marketing_sales_scout_discovery_runs_campaign_started_idx','marketing_sales_scout_discovery_candidates_identity_uidx','marketing_sales_scout_discovery_candidates_review_idx','marketing_sales_scout_discovery_membership_candidate_idx'] loop
    if not exists(select 1 from pg_indexes where schemaname='public' and indexname=v_table) then raise exception 'missing discovery index %',v_table; end if;
  end loop;

  -- Synthetic campaigns and CRM prospects. No fixture reads real campaign/prospect rows.
  insert into public.marketing_campaigns(id,name,slug,channel,source,medium,campaign_name,target_path,is_active) values
    (v_active,'M2 active discovery fixture','m2-active-'||v_active,'internal','m2','m2','m2 active','/admin',true),
    (v_inactive,'M2 inactive discovery fixture','m2-inactive-'||v_inactive,'internal','m2','m2','m2 inactive','/admin',true),
    (v_missing,'M2 missing-config fixture','m2-missing-'||v_missing,'internal','m2','m2','m2 missing','/admin',true),
    (v_daily,'M2 daily fixture','m2-daily-'||v_daily,'internal','m2','m2','m2 daily','/admin',true),
    (v_rediscovery,'M2 rediscovery fixture','m2-rediscovery-'||v_rediscovery,'internal','m2','m2','m2 rediscovery','/admin',true),
    (v_failure,'M2 failure fixture','m2-failure-'||v_failure,'internal','m2','m2','m2 failure','/admin',true);
  insert into public.marketing_sales_scout_campaigns(campaign_id,status,city,country,target_categories,daily_review_target,discovery_latitude,discovery_longitude,discovery_radius_km,discovery_default_limit) values
    (v_active,'active','M2 City','NG',array['Restaurant','Hotel'],1,6.5,3.3,20,3),
    (v_inactive,'paused','M2 City','NG',array['Restaurant'],1,6.5,3.3,20,3),
    (v_missing,'active','M2 City','NG',array['Restaurant'],1,null,null,null,null),
    (v_daily,'active','M2 City','NG',array['Restaurant'],1,6.5,3.3,20,3),
    (v_rediscovery,'active','M2 City','NG',array['Restaurant'],1,6.5,3.3,20,3),
    (v_failure,'active','M2 City','NG',array['Restaurant'],1,6.5,3.3,20,3);
  insert into public.marketing_prospects(id,business_name,campaign_id,source) values(v_exact_prospect,'M2 exact prospect',v_active,'m2'),(v_later_prospect,'M2 later exact prospect',v_rediscovery,'m2');

  -- Start validation, including category normalization, running uniqueness, and daily limit.
  begin perform public.start_sales_scout_discovery_run(v_active,array['Restaurant'],1,null); raise exception 'null actor accepted'; exception when sqlstate '22023' then if sqlerrm<>'actor id is required for discovery run start' then raise; end if; end;
  begin perform public.start_sales_scout_discovery_run(gen_random_uuid(),array['Restaurant'],1,v_actor); raise exception 'unknown campaign accepted'; exception when sqlstate 'P0002' then null; end;
  begin perform public.start_sales_scout_discovery_run(v_inactive,array['Restaurant'],1,v_actor); raise exception 'inactive campaign accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery campaign must be active' then raise; end if; end;
  begin perform public.start_sales_scout_discovery_run(v_missing,array['Restaurant'],1,v_actor); raise exception 'missing config accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery campaign configuration is incomplete' then raise; end if; end;
  begin perform public.start_sales_scout_discovery_run(v_active,array['Restaurant',' restaurant '],1,v_actor); raise exception 'duplicate categories accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery categories contain duplicates' then raise; end if; end;
  begin perform public.start_sales_scout_discovery_run(v_active,array[' '],1,v_actor); raise exception 'blank category accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery categories are invalid' then raise; end if; end;
  v_result:=public.start_sales_scout_discovery_run(v_active,array[' Restaurant ','Hotel '],3,v_actor); v_run:=(v_result->>'runId')::uuid;
  if v_result->'requestedCategories'<>jsonb_build_array('Restaurant','Hotel') or v_result->>'status'<>'running' then raise exception 'start DTO invalid'; end if;
  begin perform public.start_sales_scout_discovery_run(v_active,array['Restaurant'],1,v_actor); raise exception 'second running run accepted'; exception when sqlstate '23505' or sqlstate '22023' then null; end;
  insert into public.marketing_sales_scout_discovery_runs(scout_campaign_id,provider,status,requested_categories,requested_result_limit,latitude,longitude,radius_km,started_by,started_at,completed_at)
  select v_daily,'dataforseo_business_listings','failed',array['Restaurant'],1,6.5,3.3,20,v_actor,now()-make_interval(mins=>n),now()-make_interval(mins=>n-1) from generate_series(1,3) n;
  begin perform public.start_sales_scout_discovery_run(v_daily,array['Restaurant'],1,v_actor); raise exception 'fourth UTC run accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery daily run limit reached' then raise; end if; end;

  -- Valid candidate and envelope mutation boundaries.
  v_payload:=jsonb_build_object('providerTaskId',' task-m2 ','providerCostUsd',1.25,'rawResultCount',3,'candidates',jsonb_build_array(
    jsonb_build_object('providerSourceId',' m2-new ','businessName','M2 new','normalizedBusinessName','m2 new','observedAt','2026-07-31T00:00:00Z','providerCategory','restaurant','mappedCampaignCategory','Restaurant','providerCategoryIds',jsonb_build_array(' restaurant ','cafe'),'additionalCategories',jsonb_build_array(' caterer '),'mappingIssues',jsonb_build_array(' city needs review '),'providerSourceUrl','https://provider.example/check','description','M2 description','fullAddress','M2 address','city','M2 City','state','M2 State','countryCode','NG','latitude',6.5,'longitude',3.3,'phone','07000000000','website','example.test','ratingValue',4.2,'ratingCount',10,'claimedIndication',true,'operatingStatus','open','normalizedCity','m2 city','preparedScore',60,'scoreVersion','ng-city-b2b-v1','scoreFactors',jsonb_build_array(jsonb_build_object('key','fixture')),'softMatchWarningCount',0),
    jsonb_build_object('providerSourceId','m2-exact','businessName','M2 exact','normalizedBusinessName','m2 exact','observedAt','2026-07-31T00:00:00Z','providerCategoryIds',jsonb_build_array(),'additionalCategories',jsonb_build_array(),'mappingIssues',jsonb_build_array(),'scoreFactors',jsonb_build_array(),'exactMatchingProspectId',v_exact_prospect::text,'softMatchWarningCount',0),
    jsonb_build_object('providerSourceId','m2-soft','businessName','M2 soft','normalizedBusinessName','m2 soft','observedAt','2026-07-31T00:00:00Z','providerCategoryIds',jsonb_build_array(),'additionalCategories',jsonb_build_array(),'mappingIssues',jsonb_build_array(),'scoreFactors',jsonb_build_array(),'softMatchWarningCount',2)
  ));
  -- Representative envelope and candidate validation failures retain the running run.
  begin perform public.complete_sales_scout_discovery_run(v_run,v_payload-'providerTaskId',v_actor); raise exception 'missing task accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery completion payload is invalid' then raise; end if; end;
  begin perform public.complete_sales_scout_discovery_run(v_run,jsonb_set(v_payload,'{providerCostUsd}','-1'::jsonb),v_actor); raise exception 'negative cost accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery completion payload is invalid' then raise; end if; end;
  begin perform public.complete_sales_scout_discovery_run(v_run,jsonb_set(v_payload,'{rawResultCount}','1.5'::jsonb),v_actor); raise exception 'decimal raw count accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery completion payload is invalid' then raise; end if; end;
  begin perform public.complete_sales_scout_discovery_run(v_run,jsonb_set(v_payload,'{candidates}','{}'::jsonb),v_actor); raise exception 'non-array candidates accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery completion payload is invalid' then raise; end if; end;
  begin perform public.complete_sales_scout_discovery_run(v_run,jsonb_set(v_payload,'{candidates,0,providerSourceUrl}','"http://localhost/x"'::jsonb),v_actor); raise exception 'localhost URL accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery candidate payload is invalid' then raise; end if; end;
  begin perform public.complete_sales_scout_discovery_run(v_run,jsonb_set(v_payload,'{candidates,0,mappedCampaignCategory}','"Unrelated"'::jsonb),v_actor); raise exception 'outside category accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery candidate payload is invalid' then raise; end if; end;
  begin perform public.complete_sales_scout_discovery_run(v_run,jsonb_set(v_payload,'{candidates,0,softMatchWarningCount}','1.5'::jsonb),v_actor); raise exception 'decimal warning accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery candidate payload is invalid' then raise; end if; end;
  begin perform public.complete_sales_scout_discovery_run(v_run,jsonb_set(v_payload,'{candidates,1,providerSourceId}','" M2-NEW "'::jsonb),v_actor); raise exception 'duplicate identities accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery completion contains duplicate provider identities' then raise; end if; end;  select count(*) into v_before_prospects from public.marketing_prospects; select count(*) into v_before_outreaches from public.marketing_prospect_outreaches; select count(*) into v_before_attributions from public.marketing_prospect_attributions;
  select count(*) into v_before_candidates from public.marketing_sales_scout_discovery_candidates where discovery_run_id=v_run; select count(*) into v_before_memberships from public.marketing_sales_scout_discovery_run_candidates where discovery_run_id=v_run;
  begin perform public.complete_sales_scout_discovery_run(v_run,jsonb_build_object('providerTaskId','x','providerCostUsd',0,'rawResultCount',2,'candidates',jsonb_build_array((v_payload->'candidates')->0,jsonb_set((v_payload->'candidates')->1,'{observedAt}','"bad"'::jsonb))),v_actor); raise exception 'late invalid candidate accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery candidate payload is invalid' then raise; end if; end;
  if (select count(*) from public.marketing_sales_scout_discovery_candidates where discovery_run_id=v_run)<>v_before_candidates or (select count(*) from public.marketing_sales_scout_discovery_run_candidates where discovery_run_id=v_run)<>v_before_memberships then raise exception 'pre-mutation validation failed'; end if;
  v_result:=public.complete_sales_scout_discovery_run(v_run,v_payload,v_actor);
  if (select status from public.marketing_sales_scout_discovery_runs where id=v_run)<>'completed' or (select staged_candidate_count from public.marketing_sales_scout_discovery_runs where id=v_run)<>3 or (select exact_duplicate_count from public.marketing_sales_scout_discovery_runs where id=v_run)<>1 then raise exception 'successful completion counts invalid'; end if;  if not exists(select 1 from public.marketing_sales_scout_discovery_runs where id=v_run and provider_task_id='task-m2' and provider_cost_usd=1.25 and raw_result_count=3 and completion_payload_fingerprint is not null) then raise exception 'completion metadata invalid'; end if;
  if not exists(select 1 from public.marketing_sales_scout_discovery_candidates where scout_campaign_id=v_active and provider_source_id='m2-new' and status='new' and provider_category='restaurant' and mapped_campaign_category='Restaurant' and provider_category_ids='["restaurant","cafe"]'::jsonb and additional_categories='["caterer"]'::jsonb and mapping_issues='["city needs review"]'::jsonb and provider_source_url='https://provider.example/check' and rating_value=4.2 and rating_count=10 and claimed_indication and prepared_score=60 and score_version='ng-city-b2b-v1') then raise exception 'canonical field persistence invalid'; end if;
  if not exists(select 1 from public.marketing_sales_scout_discovery_candidates c join public.marketing_sales_scout_discovery_run_candidates m on m.candidate_id=c.id and m.discovery_run_id=v_run where c.provider_source_id='m2-exact' and c.status='duplicate' and c.exact_matching_prospect_id=v_exact_prospect and m.is_exact_duplicate and m.exact_matching_prospect_id=v_exact_prospect) then raise exception 'exact membership facts disagree'; end if;
  if not exists(select 1 from public.marketing_sales_scout_discovery_candidates where provider_source_id='m2-soft' and status='new' and soft_match_warning_count=2 and provider_category_ids='[]'::jsonb) then raise exception 'soft candidate persistence invalid'; end if;
  if (select count(*) from public.marketing_prospects)<>v_before_prospects or (select count(*) from public.marketing_prospect_outreaches)<>v_before_outreaches or (select count(*) from public.marketing_prospect_attributions)<>v_before_attributions then raise exception 'completion crossed side-effect boundary'; end if;
  select seen_count,discovery_run_id,last_seen_at into v_seen,v_first_run,v_last_seen from public.marketing_sales_scout_discovery_candidates where scout_campaign_id=v_active and provider_source_id='m2-new';
  perform public.complete_sales_scout_discovery_run(v_run,v_payload,v_actor);
  if (select seen_count from public.marketing_sales_scout_discovery_candidates where scout_campaign_id=v_active and provider_source_id='m2-new')<>v_seen then raise exception 'replay changed seen count'; end if;
  update public.marketing_sales_scout_campaigns set status='paused' where campaign_id=v_active;
  perform public.complete_sales_scout_discovery_run(v_run,v_payload,v_actor);
  begin perform public.complete_sales_scout_discovery_run(v_run,jsonb_set(v_payload,'{providerTaskId}','"changed"'::jsonb),v_actor); raise exception 'changed replay accepted'; exception when sqlstate '22023' then if sqlerrm<>'discovery completion payload differs from completed run' then raise; end if; end;

  -- Rediscovery history and failure idempotence.
  v_result:=public.start_sales_scout_discovery_run(v_rediscovery,array['Restaurant'],3,v_actor); v_run_two:=(v_result->>'runId')::uuid;
  perform public.complete_sales_scout_discovery_run(v_run_two,jsonb_build_object('providerTaskId','rediscovery','providerCostUsd',0,'rawResultCount',1,'candidates',jsonb_build_array(jsonb_build_object('providerSourceId','m2-rediscovery','businessName','M2 original','normalizedBusinessName','m2 original','observedAt','2026-07-31T00:00:00Z','providerCategoryIds',jsonb_build_array(),'additionalCategories',jsonb_build_array(),'mappingIssues',jsonb_build_array(),'scoreFactors',jsonb_build_array(),'softMatchWarningCount',0))),v_actor);  select discovery_run_id,seen_count into v_first_run,v_seen from public.marketing_sales_scout_discovery_candidates where scout_campaign_id=v_rediscovery and provider_source_id='m2-rediscovery';
  update public.marketing_sales_scout_discovery_candidates set status='captured',captured_prospect_id=v_later_prospect,reviewed_by=v_actor,reviewed_at=now() where scout_campaign_id=v_rediscovery and provider_source_id='m2-rediscovery';
  v_result:=public.start_sales_scout_discovery_run(v_rediscovery,array['Restaurant'],3,v_actor); v_run_two:=(v_result->>'runId')::uuid;
  perform public.complete_sales_scout_discovery_run(v_run_two,jsonb_build_object('providerTaskId','rediscovery-two','providerCostUsd',0,'rawResultCount',1,'candidates',jsonb_build_array(jsonb_build_object('providerSourceId','m2-rediscovery','businessName','M2 refreshed','normalizedBusinessName','m2 refreshed','observedAt','2026-08-01T00:00:00Z','providerCategoryIds',jsonb_build_array(),'additionalCategories',jsonb_build_array(),'mappingIssues',jsonb_build_array(),'scoreFactors',jsonb_build_array(),'softMatchWarningCount',1))),v_actor);
  if not exists(select 1 from public.marketing_sales_scout_discovery_candidates where scout_campaign_id=v_rediscovery and provider_source_id='m2-rediscovery' and discovery_run_id=v_first_run and last_discovery_run_id=v_run_two and seen_count=v_seen+1 and business_name='M2 refreshed' and status='captured' and captured_prospect_id=v_later_prospect and reviewed_by=v_actor) then raise exception 'rediscovery history or owner state invalid'; end if;
  if (select count(*) from public.marketing_sales_scout_discovery_run_candidates m join public.marketing_sales_scout_discovery_candidates c on c.id=m.candidate_id where c.scout_campaign_id=v_rediscovery and c.provider_source_id='m2-rediscovery')<>2 then raise exception 'rediscovery membership history invalid'; end if;
  v_result:=public.start_sales_scout_discovery_run(v_failure,array['Restaurant'],1,v_actor); v_run:=(v_result->>'runId')::uuid;  begin perform public.fail_sales_scout_discovery_run(v_run,'ref','message',null); raise exception 'null failure actor accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.fail_sales_scout_discovery_run(v_run,' ','message',v_actor); raise exception 'blank failure ref accepted'; exception when sqlstate '22023' then null; end;
  perform public.fail_sales_scout_discovery_run(v_run,' failure-ref ',' safe failure ',v_actor); perform public.fail_sales_scout_discovery_run(v_run,'failure-ref','safe failure',v_actor);
  if (select status from public.marketing_sales_scout_discovery_runs where id=v_run)<>'failed' then raise exception 'failure transition invalid'; end if;  if not exists(select 1 from public.marketing_sales_scout_discovery_runs where id=v_run and error_reference='failure-ref' and error_safe_message='safe failure') then raise exception 'failure normalization invalid'; end if;
  begin perform public.fail_sales_scout_discovery_run(v_run,'different','safe failure',v_actor); raise exception 'different failure replay accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.complete_sales_scout_discovery_run(v_run,jsonb_build_object('providerTaskId','failed','providerCostUsd',0,'rawResultCount',0,'candidates',jsonb_build_array()),v_actor); raise exception 'failed run completed'; exception when sqlstate '22023' then null; end;
  begin perform public.fail_sales_scout_discovery_run((select id from public.marketing_sales_scout_discovery_runs where scout_campaign_id=v_active and status='completed' limit 1),'ref','message',v_actor); raise exception 'completed run failed'; exception when sqlstate '22023' then null; end;
  if not exists(select 1 from public.marketing_campaigns where name like 'M2 % fixture') then raise exception 'synthetic fixtures missing before rollback'; end if;
end $$;

rollback;