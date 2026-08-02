-- Shields Farms Sales Scout Batch 6B: provider-neutral research and human outreach.
-- Repeat-safe. Preserves the dormant DataForSEO adapter and never sends external messages.

begin;

alter table public.marketing_sales_scout_campaigns
  add column if not exists max_enrichment_candidates integer not null default 6;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.marketing_sales_scout_campaigns'::regclass
      and conname='marketing_sales_scout_campaigns_max_enrichment_check'
  ) then
    alter table public.marketing_sales_scout_campaigns
      add constraint marketing_sales_scout_campaigns_max_enrichment_check
      check (max_enrichment_candidates between 1 and 20);
  end if;
end $$;

alter table public.marketing_sales_scout_discovery_runs
  alter column latitude drop not null,
  alter column longitude drop not null;

alter table public.marketing_sales_scout_discovery_runs
  drop constraint if exists marketing_sales_scout_discovery_runs_requested_result_limit_check;
alter table public.marketing_sales_scout_discovery_runs
  add constraint marketing_sales_scout_discovery_runs_requested_result_limit_check
  check (requested_result_limit between 1 and 100) not valid;
alter table public.marketing_sales_scout_discovery_runs
  validate constraint marketing_sales_scout_discovery_runs_requested_result_limit_check;

alter table public.marketing_sales_scout_campaigns
  drop constraint if exists marketing_sales_scout_campaigns_discovery_limit_check;
alter table public.marketing_sales_scout_campaigns
  add constraint marketing_sales_scout_campaigns_discovery_limit_check
  check (discovery_default_limit is null or discovery_default_limit between 1 and 100) not valid;
alter table public.marketing_sales_scout_campaigns
  validate constraint marketing_sales_scout_campaigns_discovery_limit_check;

alter table public.marketing_prospect_outreaches
  add column if not exists next_recommended_action text;

create unique index if not exists marketing_prospect_outreaches_prospect_sequence_uidx
  on public.marketing_prospect_outreaches(prospect_id,sequence_number);
alter table public.marketing_sales_scout_discovery_runs
  add column if not exists research_method text,
  add column if not exists requested_enrichment_limit integer,
  add column if not exists structured_seed_count integer not null default 0,
  add column if not exists discarded_source_document_count integer not null default 0,
  add column if not exists enrichment_attempted_count integer not null default 0,
  add column if not exists enrichment_completed_count integer not null default 0,
  add column if not exists official_websites_researched integer not null default 0,
  add column if not exists manual_review_ready_count integer not null default 0,
  add column if not exists outreach_ready_count integer not null default 0,
  add column if not exists provider_credits jsonb not null default '{}'::jsonb,
  add column if not exists warning_references jsonb not null default '[]'::jsonb;

alter table public.marketing_sales_scout_discovery_candidates
  add column if not exists geoapify_place_id text,
  add column if not exists territory_match_evidence jsonb not null default '{}'::jsonb,
  add column if not exists distance_km numeric,
  add column if not exists phone_routes jsonb not null default '[]'::jsonb,
  add column if not exists email_routes jsonb not null default '[]'::jsonb,
  add column if not exists whatsapp_routes jsonb not null default '[]'::jsonb,
  add column if not exists social_profiles jsonb not null default '[]'::jsonb,
  add column if not exists contact_evidence jsonb not null default '[]'::jsonb,
  add column if not exists research_evidence jsonb not null default '[]'::jsonb,
  add column if not exists confidence_summary jsonb not null default '{}'::jsonb,
  add column if not exists enrichment_status text not null default 'not_selected',
  add column if not exists research_issues jsonb not null default '[]'::jsonb,
  add column if not exists manual_review_ready boolean not null default false,
  add column if not exists outreach_ready boolean not null default false;

do $$
begin
  alter table public.marketing_sales_scout_discovery_runs
    drop constraint if exists marketing_sales_scout_discovery_runs_provider_check;
  alter table public.marketing_sales_scout_discovery_runs
    add constraint marketing_sales_scout_discovery_runs_provider_check
    check (provider in ('dataforseo_business_listings','geoapify_tavily_research')) not valid;
  alter table public.marketing_sales_scout_discovery_runs
    validate constraint marketing_sales_scout_discovery_runs_provider_check;

  alter table public.marketing_sales_scout_discovery_candidates
    drop constraint if exists marketing_sales_scout_discovery_candidates_provider_check;
  alter table public.marketing_sales_scout_discovery_candidates
    add constraint marketing_sales_scout_discovery_candidates_provider_check
    check (provider in ('dataforseo_business_listings','geoapify_tavily_research')) not valid;
  alter table public.marketing_sales_scout_discovery_candidates
    validate constraint marketing_sales_scout_discovery_candidates_provider_check;

  if not exists (select 1 from pg_constraint where conrelid='public.marketing_sales_scout_discovery_runs'::regclass and conname='marketing_sales_scout_discovery_runs_research_counts_check') then
    alter table public.marketing_sales_scout_discovery_runs
      add constraint marketing_sales_scout_discovery_runs_research_counts_check check (
        (requested_enrichment_limit is null or requested_enrichment_limit between 1 and 20) and
        structured_seed_count >= 0 and discarded_source_document_count >= 0 and
        enrichment_attempted_count >= 0 and enrichment_completed_count >= 0 and
        enrichment_completed_count <= enrichment_attempted_count and
        official_websites_researched >= 0 and manual_review_ready_count >= 0 and
        outreach_ready_count >= 0 and jsonb_typeof(provider_credits)='object' and
        jsonb_typeof(warning_references)='array'
      );
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_sales_scout_discovery_candidates'::regclass and conname='marketing_sales_scout_discovery_candidates_research_check') then
    alter table public.marketing_sales_scout_discovery_candidates
      add constraint marketing_sales_scout_discovery_candidates_research_check check (
        distance_km is null or distance_km >= 0
      ) not valid;
    alter table public.marketing_sales_scout_discovery_candidates
      add constraint marketing_sales_scout_discovery_candidates_enrichment_check check (
        enrichment_status in ('not_selected','completed','partial','failed') and
        jsonb_typeof(territory_match_evidence)='object' and
        jsonb_typeof(phone_routes)='array' and jsonb_typeof(email_routes)='array' and
        jsonb_typeof(whatsapp_routes)='array' and jsonb_typeof(social_profiles)='array' and
        jsonb_typeof(contact_evidence)='array' and jsonb_typeof(research_evidence)='array' and
        jsonb_typeof(confidence_summary)='object' and jsonb_typeof(research_issues)='array' and
        (not outreach_ready or manual_review_ready)
      ) not valid;
    alter table public.marketing_sales_scout_discovery_candidates validate constraint marketing_sales_scout_discovery_candidates_research_check;
    alter table public.marketing_sales_scout_discovery_candidates validate constraint marketing_sales_scout_discovery_candidates_enrichment_check;
  end if;
end $$;

create index if not exists marketing_sales_scout_candidates_readiness_idx
  on public.marketing_sales_scout_discovery_candidates
  (scout_campaign_id,manual_review_ready,outreach_ready,last_seen_at desc);

create or replace function public.save_sales_scout_campaign(
  p_campaign_id uuid,
  p_payload jsonb,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_id uuid:=coalesce(p_campaign_id,gen_random_uuid());
  v_name text;
  v_city text;
  v_state text;
  v_status text;
  v_categories text[];
  v_slug text;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for campaign save'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception using errcode='22023',message='campaign payload is invalid'; end if;
  v_name:=nullif(trim(p_payload->>'name'),''); v_city:=nullif(trim(p_payload->>'city'),'');
  v_state:=nullif(trim(p_payload->>'state'),''); v_status:=p_payload->>'status';
  if v_name is null or length(v_name)>120 or v_city is null or length(v_city)>120 or
     v_state not in ('Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Federal Capital Territory','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara') or
     p_payload->>'country'<>'Nigeria' or v_status not in ('draft','active','paused','completed') or
     jsonb_typeof(p_payload->'targetCategories')<>'array' then
    raise exception using errcode='22023',message='campaign payload is invalid';
  end if;
  select array_agg(value order by ordinality) into v_categories
  from jsonb_array_elements_text(p_payload->'targetCategories') with ordinality as item(value,ordinality);
  if coalesce(cardinality(v_categories),0)=0 or exists(select 1 from unnest(v_categories) category where category not in ('Restaurant','Caterer','Hotel','Supermarket','Food Vendor','Food Processor','Distributor','School','Hospital','Institution')) or
     (p_payload->>'dailyReviewTarget')::numeric not between 1 and 500 or
     (p_payload->>'radiusKm')::numeric not between 1 and 50 or
     (p_payload->>'resultLimit')::numeric not between 1 and 100 or
     (p_payload->>'maxEnrichmentCandidates')::numeric not between 1 and 20 then
    raise exception using errcode='22023',message='campaign payload is invalid';
  end if;
  if ((p_payload->>'latitude') is null) <> ((p_payload->>'longitude') is null) then
    raise exception using errcode='22023',message='campaign coordinates must both be supplied or omitted';
  end if;
  if p_campaign_id is not null and not exists(select 1 from public.marketing_sales_scout_campaigns where campaign_id=p_campaign_id) then
    raise exception using errcode='P0002',message='Sales Scout campaign not found';
  end if;
  v_slug:='sales-scout-'||trim(both '-' from regexp_replace(lower(v_name),'[^a-z0-9]+','-','g'))||'-'||left(v_id::text,8);
  insert into public.marketing_campaigns(id,name,slug,channel,source,medium,campaign_name,target_path,is_active)
  values(v_id,v_name,v_slug,'internal','sales_scout','prospecting',v_name,'/admin/marketing/sales-scout',v_status='active')
  on conflict(id) do update set name=excluded.name,campaign_name=excluded.campaign_name,is_active=excluded.is_active,updated_at=now();
  insert into public.marketing_sales_scout_campaigns(
    campaign_id,status,city,state,country,target_categories,product_scope,delivery_summary,daily_review_target,
    discovery_latitude,discovery_longitude,discovery_radius_km,discovery_default_limit,max_enrichment_candidates,created_by
  ) values(
    v_id,v_status,v_city,v_state,'Nigeria',v_categories,nullif(trim(p_payload->>'productScope'),''),
    nullif(trim(p_payload->>'deliverySummary'),''),(p_payload->>'dailyReviewTarget')::integer,
    nullif(p_payload->>'latitude','')::numeric,nullif(p_payload->>'longitude','')::numeric,
    (p_payload->>'radiusKm')::integer,(p_payload->>'resultLimit')::integer,
    (p_payload->>'maxEnrichmentCandidates')::integer,p_actor_id
  ) on conflict(campaign_id) do update set
    status=excluded.status,city=excluded.city,state=excluded.state,country=excluded.country,
    target_categories=excluded.target_categories,product_scope=excluded.product_scope,
    delivery_summary=excluded.delivery_summary,daily_review_target=excluded.daily_review_target,
    discovery_latitude=excluded.discovery_latitude,discovery_longitude=excluded.discovery_longitude,
    discovery_radius_km=excluded.discovery_radius_km,discovery_default_limit=excluded.discovery_default_limit,
    max_enrichment_candidates=excluded.max_enrichment_candidates,updated_at=now();
  return jsonb_build_object('campaignId',v_id,'status',v_status);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',message='campaign payload is invalid';
end $$;

create or replace function public.start_sales_scout_research_run(
  p_campaign_id uuid,
  p_categories text[],
  p_result_limit integer,
  p_enrichment_limit integer,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_campaign public.marketing_sales_scout_campaigns%rowtype; v_run_id uuid;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for research start'; end if;
  select * into v_campaign from public.marketing_sales_scout_campaigns where campaign_id=p_campaign_id for update;
  if not found then raise exception using errcode='P0002',message='Sales Scout campaign not found'; end if;
  if v_campaign.status<>'active' then raise exception using errcode='22023',message='research campaign must be active'; end if;
  if p_result_limit not between 1 and 100 or p_enrichment_limit not between 1 and 20 or
     cardinality(p_categories) not between 1 and 10 or
     not (p_categories <@ v_campaign.target_categories) or
     exists(select 1 from unnest(p_categories) category where category not in ('Restaurant','Hotel','Supermarket')) then
    raise exception using errcode='22023',message='research start payload is invalid';
  end if;
  if exists(select 1 from public.marketing_sales_scout_discovery_runs where scout_campaign_id=p_campaign_id and status='running') then
    raise exception using errcode='22023',message='campaign already has a running research run';
  end if;
  if (select count(*) from public.marketing_sales_scout_discovery_runs where scout_campaign_id=p_campaign_id and started_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc')>=3 then
    raise exception using errcode='22023',message='discovery daily run limit reached';
  end if;
  insert into public.marketing_sales_scout_discovery_runs(
    scout_campaign_id,provider,research_method,status,requested_categories,requested_result_limit,
    requested_enrichment_limit,latitude,longitude,radius_km,started_by
  ) values(
    p_campaign_id,'geoapify_tavily_research','seed_first_candidate_specific','running',p_categories,
    p_result_limit,p_enrichment_limit,v_campaign.discovery_latitude,v_campaign.discovery_longitude,
    v_campaign.discovery_radius_km,p_actor_id
  ) returning id into v_run_id;
  return jsonb_build_object('runId',v_run_id,'status','running');
end $$;

create or replace function public.complete_sales_scout_research_run(
  p_run_id uuid,
  p_payload jsonb,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_run public.marketing_sales_scout_discovery_runs%rowtype;
  v_campaign public.marketing_sales_scout_campaigns%rowtype;
  v_item jsonb; v_candidate_id uuid; v_fingerprint text; v_staged integer; v_exact integer;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for research completion'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'candidates')<>'array' or
     jsonb_typeof(p_payload->'providerCredits')<>'object' or jsonb_typeof(p_payload->'warnings')<>'array' then
    raise exception using errcode='22023',message='research completion payload is invalid';
  end if;
  if jsonb_typeof(p_payload->'providerTaskId')<>'string' or nullif(trim(p_payload->>'providerTaskId'),'') is null or length(trim(p_payload->>'providerTaskId'))>300 or
     jsonb_typeof(p_payload->'rawResultCount')<>'number' or jsonb_typeof(p_payload->'structuredSeedCount')<>'number' or
     jsonb_typeof(p_payload->'discardedSourceDocumentCount')<>'number' or jsonb_typeof(p_payload->'enrichmentAttemptedCount')<>'number' or
     jsonb_typeof(p_payload->'enrichmentCompletedCount')<>'number' or jsonb_typeof(p_payload->'officialWebsitesResearched')<>'number' or
     jsonb_typeof(p_payload->'resolvedTerritory')<>'object' then
    raise exception using errcode='22023',message='research completion payload is invalid';
  end if;
  if exists(select 1 from (values
    ((p_payload->>'rawResultCount')::numeric),((p_payload->>'structuredSeedCount')::numeric),
    ((p_payload->>'discardedSourceDocumentCount')::numeric),((p_payload->>'enrichmentAttemptedCount')::numeric),
    ((p_payload->>'enrichmentCompletedCount')::numeric),((p_payload->>'officialWebsitesResearched')::numeric)
  ) counts(value) where value<0 or value>2147483647 or value<>trunc(value)) then
    raise exception using errcode='22023',message='research completion payload is invalid';
  end if;  select * into v_run from public.marketing_sales_scout_discovery_runs where id=p_run_id for update;
  if not found then raise exception using errcode='P0002',message='research run not found'; end if;
  v_fingerprint:=md5(p_payload::text);
  if v_run.status='completed' then
    if v_run.completion_payload_fingerprint=v_fingerprint then return jsonb_build_object('runId',v_run.id,'status','completed','stagedCandidateCount',v_run.staged_candidate_count); end if;
    raise exception using errcode='22023',message='research completion payload differs from completed run';
  end if;
  if v_run.status<>'running' or v_run.provider<>'geoapify_tavily_research' then raise exception using errcode='22023',message='research run is not running'; end if;
  select * into v_campaign from public.marketing_sales_scout_campaigns where campaign_id=v_run.scout_campaign_id;
  if not found or v_campaign.status<>'active' then raise exception using errcode='22023',message='research campaign must be active'; end if;
  if jsonb_array_length(p_payload->'candidates')>v_run.requested_result_limit*cardinality(v_run.requested_categories) or
     exists(select 1 from jsonb_array_elements(p_payload->'candidates') item group by item->>'providerSourceId' having count(*)>1) then
    raise exception using errcode='22023',message='research completion payload is invalid';
  end if;
  for v_item in select value from jsonb_array_elements(p_payload->'candidates') loop
    if jsonb_typeof(v_item)<>'object' or nullif(trim(v_item->>'providerSourceId'),'') is null or
       nullif(trim(v_item->>'businessName'),'') is null or length(trim(v_item->>'businessName'))>200 or length(trim(v_item->>'providerSourceId'))>300 or
       nullif(trim(v_item->>'mappedCampaignCategory'),'') is null or jsonb_typeof(v_item->'territoryMatchEvidence')<>'object' or
       coalesce((v_item->'territoryMatchEvidence'->>'matched')::boolean,false) is not true or
       jsonb_typeof(v_item->'contacts')<>'array' or jsonb_typeof(v_item->'researchEvidence')<>'array' or
       jsonb_typeof(v_item->'researchIssues')<>'array' or jsonb_typeof(v_item->'providerCategoryIds')<>'array' or
       jsonb_typeof(v_item->'additionalCategories')<>'array' or jsonb_typeof(v_item->'mappingIssues')<>'array' or
       jsonb_typeof(v_item->'manualReviewReady')<>'boolean' or jsonb_typeof(v_item->'outreachReady')<>'boolean' or
       jsonb_typeof(v_item->'observedAt')<>'string' or (v_item->>'mappedCampaignCategory')<>all(v_run.requested_categories) or
       ((v_item->>'exactMatchingProspectId') is not null and not exists(select 1 from public.marketing_prospects where id=(v_item->>'exactMatchingProspectId')::uuid)) or
       ((v_item->>'manualReviewReady')::boolean and jsonb_array_length(v_item->'contacts')=0) or
       ((v_item->>'outreachReady')::boolean and not exists(select 1 from jsonb_array_elements(v_item->'contacts') contact where contact->>'confidence'='verified')) or
       exists(select 1 from jsonb_array_elements(v_item->'contacts') contact where
         contact->>'route' not in ('phone','whatsapp','email','website','instagram','facebook','tiktok','x','youtube') or
         contact->>'confidence' not in ('verified','plausible') or nullif(trim(contact->>'normalizedIdentity'),'') is null or
         nullif(trim(contact->>'displayValue'),'') is null or nullif(trim(contact->>'sourceType'),'') is null or
         nullif(trim(contact->>'sourceUrl'),'') is null or nullif(trim(contact->>'observedAt'),'') is null) then
      raise exception using errcode='22023',message='research candidate payload is invalid';
    end if;
  end loop;
  -- Complete the validation pass, including every value cast during persistence.
  for v_item in select value from jsonb_array_elements(p_payload->'candidates') loop
    if ((v_item->>'latitude') is not null and jsonb_typeof(v_item->'latitude')<>'number') or
       ((v_item->>'longitude') is not null and jsonb_typeof(v_item->'longitude')<>'number') or
       ((v_item->>'distanceKm') is not null and jsonb_typeof(v_item->'distanceKm')<>'number') or
       ((v_item->>'softMatchWarningCount') is not null and jsonb_typeof(v_item->'softMatchWarningCount')<>'number') then
      raise exception using errcode='22023',message='research candidate payload is invalid';
    end if;
    perform (v_item->>'observedAt')::timestamptz,
      nullif(v_item->>'latitude','')::numeric,nullif(v_item->>'longitude','')::numeric,
      nullif(v_item->>'distanceKm','')::numeric,coalesce((v_item->>'softMatchWarningCount')::integer,0),
      nullif(v_item->>'exactMatchingProspectId','')::uuid;
  end loop;

  for v_item in select value from jsonb_array_elements(p_payload->'candidates') loop
    insert into public.marketing_sales_scout_discovery_candidates(
      discovery_run_id,last_discovery_run_id,scout_campaign_id,provider,provider_source_id,geoapify_place_id,
      status,business_name,provider_category,mapped_campaign_category,provider_category_ids,additional_categories,
      mapping_issues,provider_source_url,public_description,full_address,city,state,country_code,latitude,longitude,
      public_phone,public_website,observed_at,normalized_business_name,normalized_city,exact_matching_prospect_id,
      soft_match_warning_count,territory_match_evidence,distance_km,phone_routes,email_routes,whatsapp_routes,
      social_profiles,contact_evidence,research_evidence,confidence_summary,enrichment_status,research_issues,
      manual_review_ready,outreach_ready
    ) values(
      v_run.id,v_run.id,v_run.scout_campaign_id,'geoapify_tavily_research',trim(v_item->>'providerSourceId'),
      trim(v_item->>'providerSourceId'),case when v_item->>'exactMatchingProspectId' is null then 'new' else 'duplicate' end,
      trim(v_item->>'businessName'),nullif(trim(v_item->>'providerCategory'),''),nullif(trim(v_item->>'mappedCampaignCategory'),''),
      coalesce(v_item->'providerCategoryIds','[]'),coalesce(v_item->'additionalCategories','[]'),coalesce(v_item->'mappingIssues','[]'),
      nullif(trim(v_item->>'providerSourceUrl'),''),nullif(trim(v_item->>'description'),''),nullif(trim(v_item->>'fullAddress'),''),
      nullif(trim(v_item->>'city'),''),nullif(trim(v_item->>'state'),''),'NG',nullif(v_item->>'latitude','')::numeric,
      nullif(v_item->>'longitude','')::numeric,nullif(trim(v_item->>'phone'),''),nullif(trim(v_item->>'website'),''),
      (v_item->>'observedAt')::timestamptz,trim(v_item->>'normalizedBusinessName'),nullif(trim(v_item->>'normalizedCity'),''),
      nullif(v_item->>'exactMatchingProspectId','')::uuid,coalesce((v_item->>'softMatchWarningCount')::integer,0),
      v_item->'territoryMatchEvidence',nullif(v_item->>'distanceKm','')::numeric,
      coalesce(v_item->'phoneRoutes','[]'),coalesce(v_item->'emailRoutes','[]'),coalesce(v_item->'whatsappRoutes','[]'),
      coalesce(v_item->'socialProfiles','[]'),v_item->'contacts',v_item->'researchEvidence',
      coalesce(v_item->'confidenceSummary','{}'),v_item->>'enrichmentStatus',v_item->'researchIssues',
      coalesce((v_item->>'manualReviewReady')::boolean,false),coalesce((v_item->>'outreachReady')::boolean,false)
    ) on conflict(scout_campaign_id,provider,provider_source_id) do update set
      last_discovery_run_id=excluded.last_discovery_run_id,last_seen_at=now(),
      seen_count=marketing_sales_scout_discovery_candidates.seen_count+1,business_name=excluded.business_name,
      provider_category=excluded.provider_category,mapped_campaign_category=excluded.mapped_campaign_category,
      provider_source_url=excluded.provider_source_url,public_description=excluded.public_description,
      full_address=excluded.full_address,city=excluded.city,state=excluded.state,latitude=excluded.latitude,
      longitude=excluded.longitude,public_phone=excluded.public_phone,public_website=excluded.public_website,
      observed_at=excluded.observed_at,territory_match_evidence=excluded.territory_match_evidence,
      distance_km=excluded.distance_km,phone_routes=excluded.phone_routes,email_routes=excluded.email_routes,
      whatsapp_routes=excluded.whatsapp_routes,social_profiles=excluded.social_profiles,
      contact_evidence=excluded.contact_evidence,research_evidence=excluded.research_evidence,
      confidence_summary=excluded.confidence_summary,enrichment_status=excluded.enrichment_status,
      research_issues=excluded.research_issues,manual_review_ready=excluded.manual_review_ready,
      outreach_ready=excluded.outreach_ready,exact_matching_prospect_id=excluded.exact_matching_prospect_id,
      soft_match_warning_count=excluded.soft_match_warning_count,
      status=case when marketing_sales_scout_discovery_candidates.status in ('captured','dismissed') then marketing_sales_scout_discovery_candidates.status when excluded.exact_matching_prospect_id is not null then 'duplicate' when marketing_sales_scout_discovery_candidates.status='reviewing' then 'reviewing' else 'new' end,
      updated_at=now() returning id into v_candidate_id;
    insert into public.marketing_sales_scout_discovery_run_candidates(
      discovery_run_id,candidate_id,is_exact_duplicate,exact_matching_prospect_id,soft_match_warning_count
    ) values(v_run.id,v_candidate_id,(v_item->>'exactMatchingProspectId') is not null,
      nullif(v_item->>'exactMatchingProspectId','')::uuid,coalesce((v_item->>'softMatchWarningCount')::integer,0))
    on conflict do nothing;
  end loop;
  select count(*),count(*) filter(where is_exact_duplicate) into v_staged,v_exact
  from public.marketing_sales_scout_discovery_run_candidates where discovery_run_id=v_run.id;
  update public.marketing_sales_scout_discovery_runs set
    status='completed',provider_task_id=nullif(trim(p_payload->>'providerTaskId'),''),
    raw_result_count=coalesce((p_payload->>'rawResultCount')::integer,0),staged_candidate_count=v_staged,
    exact_duplicate_count=v_exact,structured_seed_count=coalesce((p_payload->>'structuredSeedCount')::integer,0),
    discarded_source_document_count=coalesce((p_payload->>'discardedSourceDocumentCount')::integer,0),
    enrichment_attempted_count=coalesce((p_payload->>'enrichmentAttemptedCount')::integer,0),
    enrichment_completed_count=coalesce((p_payload->>'enrichmentCompletedCount')::integer,0),
    official_websites_researched=coalesce((p_payload->>'officialWebsitesResearched')::integer,0),
    manual_review_ready_count=(select count(*) from public.marketing_sales_scout_discovery_run_candidates membership join public.marketing_sales_scout_discovery_candidates candidate on candidate.id=membership.candidate_id where membership.discovery_run_id=v_run.id and candidate.manual_review_ready),
    outreach_ready_count=(select count(*) from public.marketing_sales_scout_discovery_run_candidates membership join public.marketing_sales_scout_discovery_candidates candidate on candidate.id=membership.candidate_id where membership.discovery_run_id=v_run.id and candidate.outreach_ready),
    provider_credits=p_payload->'providerCredits',warning_references=p_payload->'warnings',
    completion_payload_fingerprint=v_fingerprint,completed_at=now(),updated_at=now()
  where id=v_run.id;
  if (p_payload->'resolvedTerritory'->>'latitude') is not null and (v_campaign.discovery_latitude is null or v_campaign.discovery_longitude is null) then
    update public.marketing_sales_scout_campaigns set
      discovery_latitude=(p_payload->'resolvedTerritory'->>'latitude')::numeric,
      discovery_longitude=(p_payload->'resolvedTerritory'->>'longitude')::numeric,updated_at=now()
    where campaign_id=v_campaign.campaign_id and discovery_latitude is null and discovery_longitude is null;
  end if;
  return jsonb_build_object('runId',v_run.id,'status','completed','stagedCandidateCount',v_staged,'exactDuplicateCount',v_exact);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',message='research completion payload is invalid';
end $$;

create or replace function public.fail_sales_scout_research_run(
  p_run_id uuid,p_error_reference text,p_error_safe_message text,p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_run public.marketing_sales_scout_discovery_runs%rowtype;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for research failure'; end if;
  if nullif(trim(p_error_reference),'') is null or length(p_error_reference)>120 or nullif(trim(p_error_safe_message),'') is null or length(p_error_safe_message)>500 then raise exception using errcode='22023',message='research failure payload is invalid'; end if;
  select * into v_run from public.marketing_sales_scout_discovery_runs where id=p_run_id for update;
  if not found then raise exception using errcode='P0002',message='research run not found'; end if;
  if v_run.status='failed' then return jsonb_build_object('runId',v_run.id,'status','failed'); end if;
  if v_run.status<>'running' then raise exception using errcode='22023',message='research run is not running'; end if;
  update public.marketing_sales_scout_discovery_runs set status='failed',error_reference=trim(p_error_reference),error_safe_message=trim(p_error_safe_message),completed_at=now(),updated_at=now() where id=v_run.id;
  return jsonb_build_object('runId',v_run.id,'status','failed');
end $$;

create or replace function public.apply_sales_scout_capture_evidence(
  p_prospect_id uuid,p_location_evidence jsonb,p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_actor_id is null or jsonb_typeof(p_location_evidence)<>'object' or p_location_evidence->>'basis'<>'coordinates_within_campaign_radius' then raise exception using errcode='22023',message='capture location evidence is invalid'; end if;
  update public.marketing_prospects set location_evidence=p_location_evidence,updated_at=now()
  where id=p_prospect_id and scout_status is not null;
  if not found then raise exception using errcode='P0002',message='prospect not found'; end if;
  return jsonb_build_object('prospectId',p_prospect_id,'updated',true);
end $$;

create or replace function public.save_sales_scout_outreach_draft(
  p_prospect_id uuid,p_channel_id uuid,p_sequence_number smallint,p_draft_text text,p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prospect public.marketing_prospects%rowtype; v_id uuid; v_kind text;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for outreach draft'; end if;
  if p_sequence_number not between 1 and 3 or nullif(trim(p_draft_text),'') is null or length(trim(p_draft_text))>4000 then raise exception using errcode='22023',message='outreach draft payload is invalid'; end if;
  select * into v_prospect from public.marketing_prospects where id=p_prospect_id for update;
  if not found then raise exception using errcode='P0002',message='prospect not found'; end if;
  if v_prospect.do_not_contact_at is not null or v_prospect.scout_status in ('do_not_contact','disqualified','converted','closed') then raise exception using errcode='22023',message='prospect is not eligible for outreach'; end if;
  if not exists(select 1 from public.marketing_prospect_channels where id=p_channel_id and prospect_id=p_prospect_id and is_active) then raise exception using errcode='22023',message='active prospect channel is required'; end if;
  if p_sequence_number>1 and not exists(select 1 from public.marketing_prospect_outreaches where prospect_id=p_prospect_id and sequence_number=p_sequence_number-1 and status in ('sent','no_response')) then raise exception using errcode='22023',message='previous outreach sequence has not been completed'; end if;
  v_kind:=case p_sequence_number when 1 then 'initial' when 2 then 'follow_up_1' else 'follow_up_2' end;
  insert into public.marketing_prospect_outreaches(prospect_id,channel_id,sequence_number,kind,status,draft_text,draft_source,personalization_facts)
  values(p_prospect_id,p_channel_id,p_sequence_number,v_kind,'draft',trim(p_draft_text),'assistant',jsonb_build_object('generator','deterministic_batch_6b','generated_by',p_actor_id))
  on conflict(prospect_id,sequence_number) do update set channel_id=excluded.channel_id,draft_text=excluded.draft_text,status='draft',approved_text=null,approved_at=null,approved_by=null,updated_at=now()
  where marketing_prospect_outreaches.status='draft' returning id into v_id;
  if v_id is null then raise exception using errcode='22023',message='outreach can no longer be edited'; end if;
  return jsonb_build_object('outreachId',v_id,'status','draft');
end $$;

create or replace function public.approve_sales_scout_outreach_draft(
  p_outreach_id uuid,p_approved_text text,p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for outreach approval'; end if;
  if nullif(trim(p_approved_text),'') is null or length(trim(p_approved_text))>4000 then raise exception using errcode='22023',message='approved outreach text is required'; end if;
  update public.marketing_prospect_outreaches outreach set status='approved',approved_text=trim(p_approved_text),approved_at=now(),approved_by=p_actor_id,updated_at=now()
  where id=p_outreach_id and status='draft' and exists(select 1 from public.marketing_prospects prospect where prospect.id=outreach.prospect_id and prospect.do_not_contact_at is null and prospect.scout_status not in ('do_not_contact','disqualified','converted','closed'))
  returning id into v_id;
  if v_id is null then raise exception using errcode='22023',message='outreach draft cannot be approved'; end if;
  return jsonb_build_object('outreachId',v_id,'status','approved');
end $$;

create or replace function public.confirm_sales_scout_outreach_sent(
  p_outreach_id uuid,p_sent_text text,p_sender_account_label text,p_sent_at timestamptz default null,
  p_actor_id uuid default null,p_platform_reference text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prospect public.marketing_prospects%rowtype; v_outreach public.marketing_prospect_outreaches%rowtype; v_sent_at timestamptz:=coalesce(p_sent_at,now()); v_activity_id uuid; v_next timestamptz;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for send confirmation'; end if;
  if nullif(trim(p_sent_text),'') is null or nullif(trim(p_sender_account_label),'') is null then raise exception using errcode='22023',message='final sent text and sender account label are required'; end if;
  select prospect.* into v_prospect from public.marketing_prospects prospect join public.marketing_prospect_outreaches outreach on outreach.prospect_id=prospect.id where outreach.id=p_outreach_id for update of prospect;
  if not found then raise exception using errcode='P0002',message='outreach not found'; end if;
  select * into v_outreach from public.marketing_prospect_outreaches where id=p_outreach_id for update;
  if not found then raise exception using errcode='P0002',message='outreach not found'; end if;
  if v_prospect.do_not_contact_at is not null or v_prospect.scout_status in ('do_not_contact','disqualified','converted','closed') or v_outreach.status<>'approved' then raise exception using errcode='22023',message='outreach is not eligible for send confirmation'; end if;
  v_next:=case v_outreach.sequence_number when 1 then v_sent_at+interval '3 days' when 2 then v_sent_at+interval '4 days' else null end;
  update public.marketing_prospect_outreaches set status='sent',sent_text=trim(p_sent_text),sent_at=v_sent_at,sent_by=p_actor_id,sender_account_label=trim(p_sender_account_label),platform_reference=nullif(trim(p_platform_reference),''),due_at=v_next,updated_at=now() where id=p_outreach_id;
  update public.marketing_prospects set stage=case when stage='identified' then 'contacted' else stage end,scout_status=case when scout_status in ('new','researching','qualified') then 'engaged' else scout_status end,last_contact_at=v_sent_at,assigned_follow_up_at=v_next,updated_at=now() where id=v_outreach.prospect_id;
  insert into public.marketing_prospect_activities(prospect_id,activity_type,stage_from,stage_to,summary,occurred_at,next_follow_up_at,created_by,metadata)
  values(v_outreach.prospect_id,'sales_scout',case when v_prospect.stage='identified' then 'identified' end,case when v_prospect.stage='identified' then 'contacted' end,'Manual outreach send recorded.',v_sent_at,v_next,p_actor_id,jsonb_build_object('event','outreach_sent','outreach_id',p_outreach_id,'channel_id',v_outreach.channel_id,'sequence_number',v_outreach.sequence_number,'platform_delivery_claimed',false)) returning id into v_activity_id;
  return jsonb_build_object('outreachId',p_outreach_id,'prospectId',v_outreach.prospect_id,'sentAt',v_sent_at,'nextFollowUpAt',v_next,'activityId',v_activity_id);
end $$;

create or replace function public.record_sales_scout_outreach_outcome(
  p_outreach_id uuid,p_outcome text,p_summary text,p_commercial_signal text,p_replied_at timestamptz,p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_outreach public.marketing_prospect_outreaches%rowtype; v_now timestamptz:=coalesce(p_replied_at,now()); v_activity uuid;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for outreach outcome'; end if;
  if p_outcome not in ('interested','warm','neutral','not_interested','opt_out','irrelevant','wants_pricing','wants_product_list','wants_call','referred','no_response','cancelled') or nullif(trim(p_summary),'') is null or length(trim(p_summary))>2000 then raise exception using errcode='22023',message='outreach outcome payload is invalid'; end if;
  select * into v_outreach from public.marketing_prospect_outreaches where id=p_outreach_id for update;
  if not found then raise exception using errcode='P0002',message='outreach not found'; end if;
  if v_outreach.status not in ('sent','no_response') then raise exception using errcode='22023',message='only sent outreach can receive an outcome'; end if;
  if p_outcome='no_response' then
    update public.marketing_prospect_outreaches set status='no_response',reply_summary=trim(p_summary),recorded_by=p_actor_id,updated_at=now() where id=p_outreach_id;
    insert into public.marketing_prospect_activities(prospect_id,activity_type,summary,occurred_at,created_by,metadata) values(v_outreach.prospect_id,'sales_scout','No response recorded.',v_now,p_actor_id,jsonb_build_object('event','outreach_no_response','outreach_id',p_outreach_id,'external_message_sent',false)) returning id into v_activity;
    return jsonb_build_object('outreachId',p_outreach_id,'prospectId',v_outreach.prospect_id,'outcome',p_outcome,'activityId',v_activity);
  end if;
  if p_outcome='cancelled' then
    update public.marketing_prospect_outreaches set status='cancelled',cancel_reason=trim(p_summary),recorded_by=p_actor_id,updated_at=now() where id=p_outreach_id;
    update public.marketing_prospect_outreaches set status='cancelled',cancel_reason='Outreach workflow cancelled by owner.',updated_at=now() where prospect_id=v_outreach.prospect_id and sequence_number>v_outreach.sequence_number and status in ('draft','approved','no_response');
    insert into public.marketing_prospect_activities(prospect_id,activity_type,summary,occurred_at,created_by,metadata) values(v_outreach.prospect_id,'sales_scout','Outreach cancelled.',v_now,p_actor_id,jsonb_build_object('event','outreach_cancelled','outreach_id',p_outreach_id,'external_message_sent',false)) returning id into v_activity;
    return jsonb_build_object('outreachId',p_outreach_id,'prospectId',v_outreach.prospect_id,'outcome',p_outcome,'activityId',v_activity);
  end if;
  update public.marketing_prospect_outreaches set status='replied',reply_summary=trim(p_summary),reply_sentiment=case when p_outcome in ('interested','warm','neutral','not_interested','opt_out','irrelevant') then p_outcome when p_outcome in ('wants_pricing','wants_product_list','wants_call','referred') then 'interested' end,commercial_signal=p_outcome in ('interested','warm','wants_pricing','wants_product_list','wants_call','referred'),next_recommended_action=nullif(trim(p_commercial_signal),''),replied_at=v_now,recorded_by=p_actor_id,updated_at=now() where id=p_outreach_id;
  update public.marketing_prospect_outreaches set status='cancelled',cancel_reason='Reply or commercial outcome recorded.',updated_at=now() where prospect_id=v_outreach.prospect_id and sequence_number>v_outreach.sequence_number and status in ('draft','approved','no_response');
  update public.marketing_prospects set stage=case when stage in ('identified','contacted') then 'responded' else stage end,assigned_follow_up_at=null,updated_at=now() where id=v_outreach.prospect_id;
  insert into public.marketing_prospect_activities(prospect_id,activity_type,summary,occurred_at,created_by,metadata) values(v_outreach.prospect_id,'sales_scout','Outreach reply recorded.',v_now,p_actor_id,jsonb_build_object('event','outreach_reply','outreach_id',p_outreach_id,'outcome',p_outcome,'commercial_signal',p_commercial_signal,'external_reply_sent',false)) returning id into v_activity;
  if p_outcome='opt_out' then perform public.set_sales_scout_do_not_contact(v_outreach.prospect_id,trim(p_summary),'prospect_request',p_actor_id); end if;
  return jsonb_build_object('outreachId',p_outreach_id,'prospectId',v_outreach.prospect_id,'outcome',p_outcome,'activityId',v_activity);
end $$;

create or replace function public.suppress_sales_scout_outreach_for_prospect_state()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.do_not_contact_at is not null or new.scout_status in ('do_not_contact','disqualified','converted','closed') or new.stage in ('won','lost','recurring_customer') then
    update public.marketing_prospect_outreaches set status=case when status='sent' then status else 'cancelled' end,cancel_reason=case when status='sent' then cancel_reason else 'Prospect state suppresses further outreach.' end,updated_at=now() where prospect_id=new.id and status in ('draft','approved','no_response');
    new.assigned_follow_up_at:=null;
  end if;
  return new;
end $$;

drop trigger if exists marketing_prospects_suppress_scout_outreach on public.marketing_prospects;
create trigger marketing_prospects_suppress_scout_outreach
before update of scout_status,stage,do_not_contact_at on public.marketing_prospects
for each row execute function public.suppress_sales_scout_outreach_for_prospect_state();

create or replace function public.suppress_sales_scout_outreach_for_inactive_channel()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.is_active and not new.is_active then
    update public.marketing_prospect_outreaches set status='cancelled',cancel_reason='Public contact channel became inactive.',updated_at=now() where channel_id=new.id and status in ('draft','approved','no_response');
  end if;
  return new;
end $$;

drop trigger if exists marketing_channels_suppress_scout_outreach on public.marketing_prospect_channels;
create trigger marketing_channels_suppress_scout_outreach
before update of is_active on public.marketing_prospect_channels
for each row execute function public.suppress_sales_scout_outreach_for_inactive_channel();
revoke all on function public.suppress_sales_scout_outreach_for_prospect_state(), public.suppress_sales_scout_outreach_for_inactive_channel() from public,anon,authenticated;
grant execute on function public.suppress_sales_scout_outreach_for_prospect_state(), public.suppress_sales_scout_outreach_for_inactive_channel() to service_role;

revoke all on function public.save_sales_scout_campaign(uuid,jsonb,uuid),
  public.start_sales_scout_research_run(uuid,text[],integer,integer,uuid),
  public.complete_sales_scout_research_run(uuid,jsonb,uuid),
  public.fail_sales_scout_research_run(uuid,text,text,uuid),
  public.apply_sales_scout_capture_evidence(uuid,jsonb,uuid),
  public.save_sales_scout_outreach_draft(uuid,uuid,smallint,text,uuid),
  public.approve_sales_scout_outreach_draft(uuid,text,uuid),
  public.record_sales_scout_outreach_outcome(uuid,text,text,text,timestamptz,uuid)
from public,anon,authenticated;

grant execute on function public.save_sales_scout_campaign(uuid,jsonb,uuid),
  public.start_sales_scout_research_run(uuid,text[],integer,integer,uuid),
  public.complete_sales_scout_research_run(uuid,jsonb,uuid),
  public.fail_sales_scout_research_run(uuid,text,text,uuid),
  public.apply_sales_scout_capture_evidence(uuid,jsonb,uuid),
  public.save_sales_scout_outreach_draft(uuid,uuid,smallint,text,uuid),
  public.approve_sales_scout_outreach_draft(uuid,text,uuid),
  public.record_sales_scout_outreach_outcome(uuid,text,text,text,timestamptz,uuid)
to service_role;

revoke all on function public.confirm_sales_scout_outreach_sent(uuid,text,text,timestamptz,uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_sales_scout_outreach_sent(uuid,text,text,timestamptz,uuid,text) to service_role;

notify pgrst,'reload schema';
commit;
