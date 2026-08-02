-- Behavioural verifier. Run only after applying migration 20260802000100.
begin;
do $$
declare v_table text; v_role text; v_privilege text; v_count integer;
begin
  foreach v_table in array array['marketing_sales_scout_discovery_runs','marketing_sales_scout_discovery_candidates','marketing_sales_scout_discovery_run_candidates'] loop
    if not exists(select 1 from pg_class where oid=('public.'||v_table)::regclass and relrowsecurity) then raise exception 'RLS missing on %',v_table; end if;
    if exists(select 1 from pg_policies where schemaname='public' and tablename=v_table) then raise exception 'unexpected policy on %',v_table; end if;
    foreach v_role in array array['PUBLIC','anon','authenticated'] loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
        if has_table_privilege(v_role,'public.'||v_table,v_privilege) then raise exception '% has % on %',v_role,v_privilege,v_table; end if;
      end loop;
    end loop;
    foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if not has_table_privilege('service_role','public.'||v_table,v_privilege) then raise exception 'service_role lacks % on %',v_privilege,v_table; end if;
    end loop;
  end loop;
  if to_regprocedure('public.start_sales_scout_research_run(uuid,text[],integer,integer,uuid)') is null or
     to_regprocedure('public.complete_sales_scout_research_run(uuid,jsonb,uuid)') is null or
     to_regprocedure('public.fail_sales_scout_research_run(uuid,text,text,uuid)') is null then raise exception 'provider-neutral RPC missing'; end if;
  if not exists(select 1 from pg_constraint where conname='marketing_sales_scout_discovery_runs_provider_check' and pg_get_constraintdef(oid) like '%dataforseo_business_listings%' and pg_get_constraintdef(oid) like '%geoapify_tavily_research%') then raise exception 'provider compatibility constraint missing'; end if;
  if has_function_privilege('anon','public.start_sales_scout_research_run(uuid,text[],integer,integer,uuid)','EXECUTE') or has_function_privilege('authenticated','public.start_sales_scout_research_run(uuid,text[],integer,integer,uuid)','EXECUTE') then raise exception 'client research execution leaked'; end if;
  if not has_function_privilege('service_role','public.start_sales_scout_research_run(uuid,text[],integer,integer,uuid)','EXECUTE') then raise exception 'service_role research execution missing'; end if;
  select count(*) into v_count from information_schema.columns where table_schema='public' and table_name='marketing_sales_scout_discovery_candidates' and column_name in ('territory_match_evidence','contact_evidence','manual_review_ready','outreach_ready');
  if v_count<>4 then raise exception 'candidate research columns missing'; end if;
  raise notice 'Batch 6B structural/security verification passed. Run repository fixtures for behavioural coverage.';
end $$;

do $$
declare
  v_actor uuid:='b6000000-0000-4000-8000-000000000001';
  v_campaign uuid:='b6000000-0000-4000-8000-000000000002';
  v_run uuid; v_second_run uuid; v_invalid_run uuid; v_payload jsonb; v_result jsonb;
  v_candidate uuid; v_before integer;
begin
  insert into public.marketing_campaigns(id,name,slug,channel,source,medium,campaign_name,target_path,is_active)
  values(v_campaign,'Batch 6B verifier','batch-6b-verifier','internal','sales_scout','prospecting','Batch 6B verifier','/admin/marketing/sales-scout',true);
  insert into public.marketing_sales_scout_campaigns(campaign_id,status,city,state,country,target_categories,product_scope,delivery_summary,daily_review_target,discovery_latitude,discovery_longitude,discovery_radius_km,discovery_default_limit,max_enrichment_candidates,created_by)
  values(v_campaign,'active','Ikeja','Lagos','Nigeria',array['Restaurant'],'fresh produce','delivery subject to logistics',5,6.6018,3.3515,15,2,1,v_actor);
  v_result:=public.start_sales_scout_research_run(v_campaign,array['Restaurant'],2,1,v_actor); v_run:=(v_result->>'runId')::uuid;
  v_payload:=jsonb_build_object('providerTaskId','fixture-one','rawResultCount',1,'structuredSeedCount',1,'discardedSourceDocumentCount',2,'enrichmentAttemptedCount',1,'enrichmentCompletedCount',1,'officialWebsitesResearched',0,'providerCredits',jsonb_build_object('geoapify',1,'tavily',2),'warnings','[]'::jsonb,'resolvedTerritory',jsonb_build_object('latitude',6.6018,'longitude',3.3515),'candidates',jsonb_build_array(jsonb_build_object('providerSourceId','geo-fixture-1','businessName','Verifier Restaurant','providerCategory','catering.restaurant','mappedCampaignCategory','Restaurant','providerCategoryIds',jsonb_build_array('catering.restaurant'),'additionalCategories','[]'::jsonb,'mappingIssues','[]'::jsonb,'providerSourceUrl','https://www.geoapify.com/place-details/?id=geo-fixture-1','description','Public fixture','fullAddress','12 Allen Avenue','city',null,'state','Lagos State','latitude',6.6018,'longitude',3.3515,'phone','07032821293','website',null,'observedAt','2026-08-02T10:00:00Z','normalizedBusinessName','verifier restaurant','normalizedCity',null,'exactMatchingProspectId',null,'softMatchWarningCount',0,'territoryMatchEvidence',jsonb_build_object('matched',true,'basis','coordinates_within_campaign_radius','provider',jsonb_build_object('city',null,'state','Lagos State','country','Nigeria'),'campaign',jsonb_build_object('city','Ikeja','state','Lagos','country','Nigeria'),'distanceKm',0),'distanceKm',0,'contacts',jsonb_build_array(jsonb_build_object('route','phone','displayValue','07032821293','normalizedIdentity','+2347032821293','sourceType','geoapify_places','sourceUrl','https://www.geoapify.com/','observedAt','2026-08-02T10:00:00Z','confidence','plausible')),'phoneRoutes',jsonb_build_array(jsonb_build_object('route','phone','displayValue','07032821293','normalizedIdentity','+2347032821293','confidence','plausible')),'emailRoutes','[]'::jsonb,'whatsappRoutes','[]'::jsonb,'socialProfiles','[]'::jsonb,'researchEvidence','[]'::jsonb,'confidenceSummary',jsonb_build_object('highest','plausible'),'enrichmentStatus','completed','researchIssues','[]'::jsonb,'manualReviewReady',true,'outreachReady',false)));
  perform public.complete_sales_scout_research_run(v_run,v_payload,v_actor);
  perform public.complete_sales_scout_research_run(v_run,v_payload,v_actor);
  select candidate_id into v_candidate from public.marketing_sales_scout_discovery_run_candidates where discovery_run_id=v_run;
  if not exists(select 1 from public.marketing_sales_scout_discovery_candidates where id=v_candidate and provider='geoapify_tavily_research' and seen_count=1 and manual_review_ready and not outreach_ready and contact_evidence->0->>'confidence'='plausible') then raise exception 'first completion persistence failed'; end if;
  if (select count(*) from public.marketing_sales_scout_discovery_run_candidates where discovery_run_id=v_run)<>1 then raise exception 'membership is not authoritative'; end if;
  v_result:=public.start_sales_scout_research_run(v_campaign,array['Restaurant'],2,1,v_actor); v_second_run:=(v_result->>'runId')::uuid;
  v_payload:=jsonb_set(jsonb_set(jsonb_set(v_payload,'{providerTaskId}','"fixture-two"'),'{candidates,0,outreachReady}'::text[],'true'::jsonb),'{candidates,0,contacts,0,confidence}'::text[],'"verified"'::jsonb);
  perform public.complete_sales_scout_research_run(v_second_run,v_payload,v_actor);
  if not exists(select 1 from public.marketing_sales_scout_discovery_candidates where id=v_candidate and seen_count=2 and outreach_ready and contact_evidence->0->>'confidence'='verified') then raise exception 'repeat identity did not update seen count/readiness'; end if;
  if not exists(select 1 from public.marketing_sales_scout_discovery_runs where id=v_run and manual_review_ready_count=1 and outreach_ready_count=0) or not exists(select 1 from public.marketing_sales_scout_discovery_runs where id=v_second_run and manual_review_ready_count=1 and outreach_ready_count=1) then raise exception 'membership-derived readiness counts failed'; end if;
  v_result:=public.start_sales_scout_research_run(v_campaign,array['Restaurant'],2,1,v_actor); v_invalid_run:=(v_result->>'runId')::uuid;
  select count(*) into v_before from public.marketing_sales_scout_discovery_candidates where scout_campaign_id=v_campaign;
  begin
    perform public.complete_sales_scout_research_run(v_invalid_run,jsonb_set(v_payload,'{candidates}',(v_payload->'candidates')||(v_payload->'candidates')),v_actor);
    raise exception 'duplicate provider identity payload was accepted';
  exception when sqlstate '22023' then null; end;
  if (select count(*) from public.marketing_sales_scout_discovery_candidates where scout_campaign_id=v_campaign)<>v_before or exists(select 1 from public.marketing_sales_scout_discovery_run_candidates where discovery_run_id=v_invalid_run) then raise exception 'invalid payload mutated persistence'; end if;
  perform public.fail_sales_scout_research_run(v_invalid_run,'VERIFIER_EXPECTED_REJECTION','Expected verifier rejection.',v_actor);
  insert into public.marketing_sales_scout_discovery_runs(scout_campaign_id,provider,status,requested_categories,requested_result_limit,latitude,longitude,radius_km,started_by) values(v_campaign,'dataforseo_business_listings','failed',array['Restaurant'],1,6.6018,3.3515,15,v_actor);
  raise notice 'Batch 6B behavioural verification passed; transaction will roll back.';
end $$;
rollback;
