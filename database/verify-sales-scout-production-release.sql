-- Behavioural verifier. Run only after applying migration 20260802000100.
-- Every fixture is enclosed by this transaction and is rolled back.
begin;

do $$
declare
  v_table text;
  v_role text;
  v_privilege text;
  v_signature text;
  v_count integer;
begin
  foreach v_table in array array[
    'marketing_sales_scout_discovery_runs',
    'marketing_sales_scout_discovery_candidates',
    'marketing_sales_scout_discovery_run_candidates'
  ] loop
    if not exists(
      select 1 from pg_class
      where oid=('public.'||v_table)::regclass and relrowsecurity
    ) then raise exception 'RLS missing on %',v_table; end if;
    if exists(
      select 1 from pg_policies where schemaname='public' and tablename=v_table
    ) then raise exception 'unexpected policy on %',v_table; end if;
    foreach v_role in array array['public','anon','authenticated'] loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
        if has_table_privilege(v_role,'public.'||v_table,v_privilege) then
          raise exception '% has % on %',v_role,v_privilege,v_table;
        end if;
      end loop;
    end loop;
    foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if not has_table_privilege('service_role','public.'||v_table,v_privilege) then
        raise exception 'service_role lacks % on %',v_privilege,v_table;
      end if;
    end loop;
  end loop;

  foreach v_signature in array array[
    'public.save_sales_scout_campaign(uuid,jsonb,uuid)',
    'public.start_sales_scout_research_run(uuid,text[],integer,integer,uuid)',
    'public.complete_sales_scout_research_run(uuid,jsonb,uuid)',
    'public.fail_sales_scout_research_run(uuid,text,text,uuid)',
    'public.apply_sales_scout_capture_evidence(uuid,jsonb,uuid)',
    'public.save_sales_scout_outreach_draft(uuid,uuid,smallint,text,uuid)',
    'public.approve_sales_scout_outreach_draft(uuid,text,uuid)',
    'public.confirm_sales_scout_outreach_sent(uuid,text,text,timestamptz,uuid,text)',
    'public.record_sales_scout_outreach_outcome(uuid,text,text,text,timestamptz,uuid)'
  ] loop
    if to_regprocedure(v_signature) is null then
      raise exception 'required RPC missing: %',v_signature;
    end if;
    foreach v_role in array array['public','anon','authenticated'] loop
      if has_function_privilege(v_role,v_signature,'EXECUTE') then
        raise exception '% can execute %',v_role,v_signature;
      end if;
    end loop;
    if not has_function_privilege('service_role',v_signature,'EXECUTE') then
      raise exception 'service_role cannot execute %',v_signature;
    end if;
  end loop;

  if not exists(
    select 1 from pg_constraint
    where conname='marketing_sales_scout_discovery_runs_provider_check'
      and pg_get_constraintdef(oid) like '%dataforseo_business_listings%'
      and pg_get_constraintdef(oid) like '%geoapify_tavily_research%'
  ) then raise exception 'provider compatibility constraint missing'; end if;
  if to_regclass('public.marketing_sales_scout_candidates_readiness_idx') is null then
    raise exception 'candidate readiness index missing';
  end if;
  if not exists(
    select 1 from pg_trigger
    where tgname='marketing_prospects_suppress_scout_outreach' and not tgisinternal
  ) or not exists(
    select 1 from pg_trigger
    where tgname='marketing_channels_suppress_scout_outreach' and not tgisinternal
  ) then raise exception 'outreach suppression trigger missing'; end if;
  select count(*) into v_count
  from information_schema.columns
  where table_schema='public'
    and (
      table_name='marketing_sales_scout_campaigns' and column_name='max_enrichment_candidates'
      or table_name='marketing_sales_scout_discovery_runs' and column_name in (
        'research_method','requested_enrichment_limit','structured_seed_count',
        'discarded_source_document_count','enrichment_attempted_count',
        'enrichment_completed_count','official_websites_researched',
        'manual_review_ready_count','outreach_ready_count','provider_credits',
        'warning_references'
      )
      or table_name='marketing_sales_scout_discovery_candidates' and column_name in (
        'geoapify_place_id','territory_match_evidence','distance_km','phone_routes',
        'email_routes','whatsapp_routes','social_profiles','contact_evidence',
        'research_evidence','confidence_summary','enrichment_status','research_issues',
        'manual_review_ready','outreach_ready'
      )
      or table_name='marketing_prospect_outreaches' and column_name='next_recommended_action'
      or table_name='marketing_prospects' and column_name='location_evidence'
    );
  if v_count<>28 then raise exception 'production release columns missing: %',v_count; end if;
  raise notice 'Batch 6B structural/security verification passed.';
end $$;

do $$
declare
  v_actor uuid:='b6000000-0000-4000-8000-000000000001';
  v_campaign uuid;
  v_stale_run uuid:='b6000000-0000-4000-8000-000000000003';
  v_run uuid;
  v_second_run uuid;
  v_result jsonb;
  v_payload jsonb;
  v_candidate uuid;
  v_capture jsonb;
  v_prospect uuid;
  v_cancel_prospect uuid;
  v_opt_out_prospect uuid;
  v_channel uuid;
  v_outreach uuid;
  v_future uuid;
begin
  v_result:=public.save_sales_scout_campaign(null,jsonb_build_object(
    'name','Batch 6B verifier',
    'status','active',
    'country','Nigeria',
    'state','Lagos',
    'city','Ikeja',
    'targetCategories',jsonb_build_array('Restaurant'),
    'productScope','fresh produce',
    'deliverySummary','delivery subject to logistics',
    'dailyReviewTarget',5,
    'latitude',6.6018,
    'longitude',3.3515,
    'radiusKm',15,
    'resultLimit',2,
    'maxEnrichmentCandidates',1
  ),v_actor);
  v_campaign:=(v_result->>'campaignId')::uuid;
  if not exists(
    select 1 from public.marketing_sales_scout_campaigns
    where campaign_id=v_campaign and status='active' and discovery_default_limit=2
  ) then raise exception 'campaign save verification failed'; end if;

  insert into public.marketing_sales_scout_discovery_runs(
    id,scout_campaign_id,provider,research_method,status,requested_categories,
    requested_result_limit,requested_enrichment_limit,latitude,longitude,radius_km,
    started_by,started_at
  ) values(
    v_stale_run,v_campaign,'geoapify_tavily_research','seed_first_candidate_specific',
    'running',array['Restaurant'],2,1,6.6018,3.3515,15,v_actor,now()-interval '1 day'
  );
  v_result:=public.start_sales_scout_research_run(
    v_campaign,array['Restaurant'],2,1,v_actor
  );
  v_run:=(v_result->>'runId')::uuid;
  if not exists(
    select 1 from public.marketing_sales_scout_discovery_runs
    where id=v_stale_run and status='failed'
      and error_reference='RESEARCH_RUN_STALE'
      and completed_at is not null
  ) then raise exception 'stale research-run recovery failed'; end if;

  v_payload:=jsonb_build_object(
    'providerTaskId','fixture-one',
    'rawResultCount',1,
    'structuredSeedCount',1,
    'discardedSourceDocumentCount',0,
    'enrichmentAttemptedCount',0,
    'enrichmentCompletedCount',0,
    'officialWebsitesResearched',0,
    'providerCredits',jsonb_build_object('geoapify',1,'tavily',0),
    'warnings','[]'::jsonb,
    'resolvedTerritory',jsonb_build_object('latitude',6.6018,'longitude',3.3515),
    'candidates',jsonb_build_array(jsonb_build_object(
      'providerSourceId','geo-fixture-1',
      'businessName','Verifier Restaurant',
      'providerCategory','catering.restaurant',
      'mappedCampaignCategory','Restaurant',
      'providerCategoryIds',jsonb_build_array('catering.restaurant'),
      'additionalCategories','[]'::jsonb,
      'mappingIssues','[]'::jsonb,
      'providerSourceUrl','https://www.geoapify.com/place-details/?id=geo-fixture-1',
      'description','Public fixture',
      'fullAddress','12 Allen Avenue',
      'city','Ikeja',
      'state','Lagos State',
      'latitude',6.6018,
      'longitude',3.3515,
      'phone','07032821293',
      'website',null,
      'observedAt','2026-08-02T10:00:00Z',
      'normalizedBusinessName','verifier restaurant',
      'normalizedCity','ikeja',
      'exactMatchingProspectId',null,
      'softMatchWarningCount',0,
      'territoryMatchEvidence',jsonb_build_object(
        'matched',true,'basis','provider_city',
        'provider',jsonb_build_object('city','Ikeja','state','Lagos State','country','Nigeria'),
        'campaign',jsonb_build_object('city','Ikeja','state','Lagos','country','Nigeria'),
        'distanceKm',0
      ),
      'distanceKm',0,
      'contacts',jsonb_build_array(jsonb_build_object(
        'route','phone','displayValue','07032821293',
        'normalizedIdentity','+2347032821293',
        'sourceType','geoapify_places',
        'sourceUrl','https://www.geoapify.com/',
        'observedAt','2026-08-02T10:00:00Z',
        'confidence','plausible'
      )),
      'phoneRoutes',jsonb_build_array(jsonb_build_object(
        'route','phone','displayValue','07032821293',
        'normalizedIdentity','+2347032821293','confidence','plausible'
      )),
      'emailRoutes','[]'::jsonb,
      'whatsappRoutes','[]'::jsonb,
      'socialProfiles','[]'::jsonb,
      'researchEvidence','[]'::jsonb,
      'confidenceSummary',jsonb_build_object('highest','plausible'),
      'enrichmentStatus','not_selected',
      'researchIssues','[]'::jsonb,
      'manualReviewReady',true,
      'outreachReady',false
    ))
  );
  perform public.complete_sales_scout_research_run(v_run,v_payload,v_actor);
  perform public.complete_sales_scout_research_run(v_run,v_payload,v_actor);
  select candidate_id into v_candidate
  from public.marketing_sales_scout_discovery_run_candidates
  where discovery_run_id=v_run;
  if not exists(
    select 1 from public.marketing_sales_scout_discovery_candidates
    where id=v_candidate and seen_count=1 and manual_review_ready
      and not outreach_ready and contact_evidence->0->>'confidence'='plausible'
  ) then raise exception 'plausible contact persistence failed'; end if;
  if (select count(*) from public.marketing_sales_scout_discovery_run_candidates where discovery_run_id=v_run)<>1 then
    raise exception 'research completion idempotency failed';
  end if;

  v_result:=public.start_sales_scout_research_run(
    v_campaign,array['Restaurant'],2,1,v_actor
  );
  v_second_run:=(v_result->>'runId')::uuid;
  v_payload:=jsonb_set(
    jsonb_set(
      jsonb_set(v_payload,'{providerTaskId}','"fixture-two"'),
      '{candidates,0,outreachReady}'::text[],'true'::jsonb
    ),
    '{candidates,0,contacts,0,confidence}'::text[],'"verified"'::jsonb
  );
  perform public.complete_sales_scout_research_run(v_second_run,v_payload,v_actor);
  if not exists(
    select 1 from public.marketing_sales_scout_discovery_candidates
    where id=v_candidate and seen_count=2 and outreach_ready
      and contact_evidence->0->>'confidence'='verified'
  ) then raise exception 'verified contact persistence failed'; end if;

  insert into public.marketing_sales_scout_discovery_runs(
    scout_campaign_id,provider,status,requested_categories,requested_result_limit,
    latitude,longitude,radius_km,started_by
  ) values(
    v_campaign,'dataforseo_business_listings','failed',array['Restaurant'],1,
    6.6018,3.3515,15,v_actor
  );
  if not exists(
    select 1 from public.marketing_sales_scout_discovery_runs
    where scout_campaign_id=v_campaign and provider='dataforseo_business_listings'
  ) then raise exception 'DataForSEO compatibility row failed'; end if;

  v_capture:=jsonb_build_object(
    'provider','geoapify_tavily_research',
    'providerSourceId','geo-outreach-1',
    'sourceUrl','https://www.geoapify.com/place-details/?id=geo-outreach-1',
    'observedAt','2026-08-02T10:00:00Z',
    'campaignId',v_campaign,
    'businessName','Outreach Fixture One',
    'normalizedBusinessName','outreach fixture one',
    'businessCategory','Restaurant',
    'city','Ikeja',
    'normalizedCity','ikeja',
    'state','Lagos',
    'country','Nigeria',
    'normalizedCountry','nigeria',
    'publicDescription','Public verifier fixture',
    'serviceAreaCities',jsonb_build_array('Ikeja'),
    'mostRecentPublicActivityAt',null,
    'recurringProduceDemandEvidence','Public restaurant operation',
    'demandBand','medium',
    'isInactiveOrClosed',false,
    'isConsumerOnly',false,
    'channels',jsonb_build_array(jsonb_build_object(
      'platform','phone','handleOrValue','08030001001',
      'identityKey','+2348030001001','profileUrl',null,'isPrimary',true,
      'sourceId','+2348030001001',
      'evidence',jsonb_build_object('confidence','plausible','reviewRequired',true)
    )),
    'exactLookupKeys',jsonb_build_array('phone:+2348030001001'),
    'score',jsonb_build_object(
      'score',80,'ruleVersion','ng-city-b2b-v1','factors','[]'::jsonb,
      'scoredAt','2026-08-02T10:00:00Z',
      'qualified',true,'qualificationFailures','[]'::jsonb
    )
  );
  v_result:=public.capture_sales_scout_candidate(v_capture,'create_new',null,v_actor);
  v_prospect:=(v_result->>'prospect_id')::uuid;
  select id into v_channel from public.marketing_prospect_channels
  where prospect_id=v_prospect and is_active order by is_primary desc limit 1;

  v_result:=public.save_sales_scout_outreach_draft(
    v_prospect,v_channel,1::smallint,'Initial verifier draft',v_actor
  );
  v_outreach:=(v_result->>'outreachId')::uuid;
  perform public.approve_sales_scout_outreach_draft(
    v_outreach,'Approved initial verifier draft',v_actor
  );
  perform public.confirm_sales_scout_outreach_sent(
    v_outreach,'Approved initial verifier draft','Verifier account',
    '2026-08-02T10:00:00Z',v_actor,null
  );
  if not exists(
    select 1 from public.marketing_prospects
    where id=v_prospect and assigned_follow_up_at='2026-08-05T10:00:00Z'
  ) then raise exception 'initial three-day follow-up failed'; end if;
  perform public.record_sales_scout_outreach_outcome(
    v_outreach,'no_response','No response after due date','',
    '2026-08-05T10:00:00Z',v_actor
  );
  if exists(
    select 1 from public.marketing_prospects
    where id=v_prospect and assigned_follow_up_at is not null
  ) then raise exception 'no-response left stale follow-up'; end if;

  v_result:=public.save_sales_scout_outreach_draft(
    v_prospect,v_channel,2::smallint,'Second verifier draft',v_actor
  );
  v_outreach:=(v_result->>'outreachId')::uuid;
  perform public.approve_sales_scout_outreach_draft(
    v_outreach,'Approved second verifier draft',v_actor
  );
  perform public.confirm_sales_scout_outreach_sent(
    v_outreach,'Approved second verifier draft','Verifier account',
    '2026-08-05T10:05:00Z',v_actor,null
  );
  insert into public.marketing_prospect_outreaches(
    prospect_id,channel_id,sequence_number,kind,status,draft_text,draft_source
  ) values(
    v_prospect,v_channel,3,'follow_up_2','draft','Future verifier draft','assistant'
  ) returning id into v_future;
  perform public.record_sales_scout_outreach_outcome(
    v_outreach,'interested','Prospect replied with interest','Owner to call',
    '2026-08-05T11:00:00Z',v_actor
  );
  if not exists(
    select 1 from public.marketing_prospect_outreaches
    where id=v_future and status='cancelled'
  ) or exists(
    select 1 from public.marketing_prospects
    where id=v_prospect and assigned_follow_up_at is not null
  ) then raise exception 'reply suppression failed'; end if;
  begin
    perform public.save_sales_scout_outreach_draft(
      v_prospect,v_channel,3::smallint,'Forbidden reply follow-up',v_actor
    );
    raise exception 'reply allowed another outreach sequence';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.save_sales_scout_outreach_draft(
      v_prospect,v_channel,4::smallint,'Forbidden fourth draft',v_actor
    );
    raise exception 'fourth outreach was accepted';
  exception when sqlstate '22023' then null; end;

  v_capture:=jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(v_capture,'{providerSourceId}','"geo-outreach-2"'),
        '{businessName}','"Outreach Fixture Two"'
      ),
      '{normalizedBusinessName}','"outreach fixture two"'
    ),
    '{channels,0}',jsonb_build_object(
      'platform','phone','handleOrValue','08030001002',
      'identityKey','+2348030001002','profileUrl',null,'isPrimary',true,
      'sourceId','+2348030001002','evidence',jsonb_build_object('confidence','verified')
    )
  );
  v_result:=public.capture_sales_scout_candidate(v_capture,'create_new',null,v_actor);
  v_cancel_prospect:=(v_result->>'prospect_id')::uuid;
  select id into v_channel from public.marketing_prospect_channels
  where prospect_id=v_cancel_prospect and is_active order by is_primary desc limit 1;
  v_result:=public.save_sales_scout_outreach_draft(
    v_cancel_prospect,v_channel,1::smallint,'Cancellation fixture',v_actor
  );
  v_outreach:=(v_result->>'outreachId')::uuid;
  perform public.approve_sales_scout_outreach_draft(v_outreach,'Cancellation fixture',v_actor);
  perform public.confirm_sales_scout_outreach_sent(
    v_outreach,'Cancellation fixture','Verifier account',now(),v_actor,null
  );
  perform public.record_sales_scout_outreach_outcome(
    v_outreach,'cancelled','Owner cancelled workflow','',now(),v_actor
  );
  if exists(
    select 1 from public.marketing_prospects
    where id=v_cancel_prospect and assigned_follow_up_at is not null
  ) then raise exception 'cancellation left stale follow-up'; end if;

  v_capture:=jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(v_capture,'{providerSourceId}','"geo-outreach-3"'),
        '{businessName}','"Outreach Fixture Three"'
      ),
      '{normalizedBusinessName}','"outreach fixture three"'
    ),
    '{channels,0}',jsonb_build_object(
      'platform','phone','handleOrValue','08030001003',
      'identityKey','+2348030001003','profileUrl',null,'isPrimary',true,
      'sourceId','+2348030001003','evidence',jsonb_build_object('confidence','plausible')
    )
  );
  v_result:=public.capture_sales_scout_candidate(v_capture,'create_new',null,v_actor);
  v_opt_out_prospect:=(v_result->>'prospect_id')::uuid;
  select id into v_channel from public.marketing_prospect_channels
  where prospect_id=v_opt_out_prospect and is_active order by is_primary desc limit 1;
  v_result:=public.save_sales_scout_outreach_draft(
    v_opt_out_prospect,v_channel,1::smallint,'Opt-out fixture',v_actor
  );
  v_outreach:=(v_result->>'outreachId')::uuid;
  perform public.approve_sales_scout_outreach_draft(v_outreach,'Opt-out fixture',v_actor);
  perform public.confirm_sales_scout_outreach_sent(
    v_outreach,'Opt-out fixture','Verifier account',now(),v_actor,null
  );
  perform public.record_sales_scout_outreach_outcome(
    v_outreach,'opt_out','Prospect requested no further contact','',now(),v_actor
  );
  if not exists(
    select 1 from public.marketing_prospects
    where id=v_opt_out_prospect and do_not_contact_at is not null
      and assigned_follow_up_at is null
  ) then raise exception 'opt-out suppression failed'; end if;

  raise notice 'Batch 6B behavioural verification passed; transaction will roll back.';
end $$;

rollback;
