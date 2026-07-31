begin;

alter table public.marketing_sales_scout_campaigns
  add column if not exists discovery_latitude numeric,
  add column if not exists discovery_longitude numeric,
  add column if not exists discovery_radius_km integer,
  add column if not exists discovery_default_limit integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_sales_scout_campaigns'::regclass and conname='marketing_sales_scout_campaigns_discovery_latitude_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_latitude_check check (discovery_latitude is null or discovery_latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_sales_scout_campaigns'::regclass and conname='marketing_sales_scout_campaigns_discovery_longitude_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_longitude_check check (discovery_longitude is null or discovery_longitude between -180 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_sales_scout_campaigns'::regclass and conname='marketing_sales_scout_campaigns_discovery_radius_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_radius_check check (discovery_radius_km is null or discovery_radius_km between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_sales_scout_campaigns'::regclass and conname='marketing_sales_scout_campaigns_discovery_limit_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_limit_check check (discovery_default_limit is null or discovery_default_limit between 1 and 50);
  end if;
end $$;

update public.marketing_sales_scout_campaigns
set discovery_latitude=coalesce(discovery_latitude,6.5244), discovery_longitude=coalesce(discovery_longitude,3.3792), discovery_radius_km=coalesce(discovery_radius_km,40), discovery_default_limit=coalesce(discovery_default_limit,25)
where lower(trim(city))='lagos' and lower(trim(country))='nigeria';

create table if not exists public.marketing_sales_scout_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  scout_campaign_id uuid not null references public.marketing_sales_scout_campaigns(campaign_id) on delete cascade,
  provider text not null check (provider='dataforseo_business_listings'),
  status text not null check (status in ('running','completed','failed')),
  requested_categories text[] not null check (cardinality(requested_categories) between 1 and 10),
  requested_result_limit integer not null check (requested_result_limit between 1 and 50),
  latitude numeric not null check (latitude between -90 and 90), longitude numeric not null check (longitude between -180 and 180), radius_km integer not null check (radius_km between 1 and 100),
  provider_task_id text, provider_cost_usd numeric(12,6) check (provider_cost_usd is null or provider_cost_usd>=0), raw_result_count integer not null default 0 check (raw_result_count>=0), staged_candidate_count integer not null default 0 check (staged_candidate_count>=0), exact_duplicate_count integer not null default 0 check (exact_duplicate_count>=0), completion_payload_fingerprint text,
  error_reference text, error_safe_message text, started_by uuid not null, started_at timestamptz not null default now(), completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists marketing_sales_scout_discovery_runs_one_running_uidx on public.marketing_sales_scout_discovery_runs(scout_campaign_id) where status='running';
create index if not exists marketing_sales_scout_discovery_runs_campaign_started_idx on public.marketing_sales_scout_discovery_runs(scout_campaign_id,started_at desc);

create table if not exists public.marketing_sales_scout_discovery_candidates (
 id uuid primary key default gen_random_uuid(), discovery_run_id uuid not null references public.marketing_sales_scout_discovery_runs(id) on delete restrict, last_discovery_run_id uuid not null references public.marketing_sales_scout_discovery_runs(id) on delete restrict, scout_campaign_id uuid not null references public.marketing_sales_scout_campaigns(campaign_id) on delete cascade, provider text not null check(provider='dataforseo_business_listings'), provider_source_id text not null check(length(trim(provider_source_id)) between 1 and 300), status text not null default 'new' check(status in('new','reviewing','duplicate','captured','dismissed')), business_name text not null check(length(trim(business_name)) between 1 and 200), provider_category text, mapped_campaign_category text, provider_category_ids jsonb not null default '[]'::jsonb check(jsonb_typeof(provider_category_ids)='array'), additional_categories jsonb not null default '[]'::jsonb check(jsonb_typeof(additional_categories)='array'), mapping_issues jsonb not null default '[]'::jsonb check(jsonb_typeof(mapping_issues)='array'), provider_source_url text, public_description text, full_address text, city text, state text, country_code text check(country_code is null or length(trim(country_code))=2), latitude numeric check(latitude is null or latitude between -90 and 90), longitude numeric check(longitude is null or longitude between -180 and 180), public_phone text, public_website text, rating_value numeric check(rating_value is null or rating_value>=0), rating_count integer check(rating_count is null or rating_count>=0), claimed_indication boolean, operating_status text, observed_at timestamptz not null, normalized_business_name text not null check(length(trim(normalized_business_name)) between 1 and 200), normalized_city text, prepared_score integer check(prepared_score is null or prepared_score between 0 and 100), score_version text, score_factors jsonb not null default '[]'::jsonb check(jsonb_typeof(score_factors)='array'), exact_matching_prospect_id uuid references public.marketing_prospects(id) on delete set null, soft_match_warning_count integer not null default 0 check(soft_match_warning_count>=0), captured_prospect_id uuid references public.marketing_prospects(id) on delete set null, dismissal_reason text, reviewed_by uuid, reviewed_at timestamptz, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), seen_count integer not null default 1 check(seen_count>=1), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(status<>'dismissed' or length(trim(coalesce(dismissal_reason,'')))>0), check(status<>'captured' or captured_prospect_id is not null), check(status<>'duplicate' or exact_matching_prospect_id is not null)
);
create unique index if not exists marketing_sales_scout_discovery_candidates_identity_uidx on public.marketing_sales_scout_discovery_candidates(scout_campaign_id,provider,provider_source_id);
create index if not exists marketing_sales_scout_discovery_candidates_review_idx on public.marketing_sales_scout_discovery_candidates(scout_campaign_id,status,last_seen_at desc);
create table if not exists public.marketing_sales_scout_discovery_run_candidates (
 discovery_run_id uuid not null references public.marketing_sales_scout_discovery_runs(id) on delete cascade, candidate_id uuid not null references public.marketing_sales_scout_discovery_candidates(id) on delete cascade, is_exact_duplicate boolean not null default false, exact_matching_prospect_id uuid references public.marketing_prospects(id) on delete set null, soft_match_warning_count integer not null default 0 check(soft_match_warning_count>=0), created_at timestamptz not null default now(), primary key(discovery_run_id,candidate_id), check(not is_exact_duplicate or exact_matching_prospect_id is not null)
);
create index if not exists marketing_sales_scout_discovery_membership_candidate_idx on public.marketing_sales_scout_discovery_run_candidates(candidate_id,created_at desc);
alter table public.marketing_sales_scout_discovery_runs enable row level security; alter table public.marketing_sales_scout_discovery_candidates enable row level security; alter table public.marketing_sales_scout_discovery_run_candidates enable row level security;
revoke all on table public.marketing_sales_scout_discovery_runs,public.marketing_sales_scout_discovery_candidates,public.marketing_sales_scout_discovery_run_candidates from public,anon,authenticated;
grant select,insert,update,delete on table public.marketing_sales_scout_discovery_runs,public.marketing_sales_scout_discovery_candidates,public.marketing_sales_scout_discovery_run_candidates to service_role;

create or replace function public.start_sales_scout_discovery_run(p_campaign_id uuid,p_categories text[],p_result_limit integer,p_actor_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_campaign public.marketing_sales_scout_campaigns%rowtype; v_categories text[]; v_run public.marketing_sales_scout_discovery_runs%rowtype;
begin
 if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for discovery run start'; end if;
 select * into v_campaign from public.marketing_sales_scout_campaigns where campaign_id=p_campaign_id for update;
 if not found then raise exception using errcode='P0002',message='discovery campaign not found'; end if;
 if v_campaign.status<>'active' then raise exception using errcode='22023',message='discovery campaign must be active'; end if;
 if v_campaign.discovery_latitude is null or v_campaign.discovery_longitude is null or v_campaign.discovery_radius_km is null or v_campaign.discovery_default_limit is null then raise exception using errcode='22023',message='discovery campaign configuration is incomplete'; end if;
 if p_categories is null or cardinality(p_categories) not between 1 and 10 or exists(select 1 from unnest(p_categories) x where x is null or trim(x)='') then raise exception using errcode='22023',message='discovery categories are invalid'; end if;
 select array_agg(trim(x) order by ordinality) into v_categories from unnest(p_categories) with ordinality t(x,ordinality);
 if exists(select 1 from unnest(v_categories) x group by lower(x) having count(*)>1) then raise exception using errcode='22023',message='discovery categories contain duplicates'; end if;
 if p_result_limit not between 1 and 50 then raise exception using errcode='22023',message='discovery result limit is invalid'; end if;
 if (select count(*) from public.marketing_sales_scout_discovery_runs where scout_campaign_id=p_campaign_id and started_at >= date_trunc('day',now() at time zone 'utc') at time zone 'utc' and started_at < (date_trunc('day',now() at time zone 'utc')+interval '1 day') at time zone 'utc')>=3 then raise exception using errcode='22023',message='discovery daily run limit reached'; end if;
 insert into public.marketing_sales_scout_discovery_runs(scout_campaign_id,provider,status,requested_categories,requested_result_limit,latitude,longitude,radius_km,started_by) values(p_campaign_id,'dataforseo_business_listings','running',v_categories,p_result_limit,v_campaign.discovery_latitude,v_campaign.discovery_longitude,v_campaign.discovery_radius_km,p_actor_id) returning * into v_run;
 return jsonb_build_object('runId',v_run.id,'campaignId',v_run.scout_campaign_id,'status',v_run.status,'requestedCategories',v_run.requested_categories,'latitude',v_run.latitude,'longitude',v_run.longitude,'radiusKm',v_run.radius_km,'limit',v_run.requested_result_limit);
end $$;

-- Completion validates the envelope and duplicate provider IDs before all mutation; membership totals are authoritative.
create or replace function public.complete_sales_scout_discovery_run(
  p_run_id uuid,
  p_payload jsonb,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_run public.marketing_sales_scout_discovery_runs%rowtype;
  v_campaign public.marketing_sales_scout_campaigns%rowtype;
  v_item jsonb;
  v_candidate_id uuid;
  v_exact_id uuid;
  v_exact boolean;
  v_fingerprint text;
  v_candidate_count integer;
  v_staged integer;
  v_exact_count integer;
  v_field text;
  v_observed_at timestamptz;
  v_prepared_score integer;
  v_soft_warning_count integer;
  v_rating_count integer;
  v_rating_value numeric;
  v_latitude numeric;
  v_longitude numeric;
  v_claimed_indication boolean;
  v_source_url text;
  v_source_authority text;
  v_provider_category_ids jsonb;
  v_additional_categories jsonb;
  v_mapping_issues jsonb;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for discovery completion'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception using errcode='22023',message='discovery completion payload is invalid'; end if;
  select * into v_run from public.marketing_sales_scout_discovery_runs where id=p_run_id for update;
  if not found then raise exception using errcode='P0002',message='discovery run not found'; end if;
  v_fingerprint:=md5(p_payload::text);
  if v_run.status='completed' then
    if v_run.completion_payload_fingerprint=v_fingerprint then return jsonb_build_object('runId',v_run.id,'status','completed','stagedCandidateCount',v_run.staged_candidate_count,'exactDuplicateCount',v_run.exact_duplicate_count); end if;
    raise exception using errcode='22023',message='discovery completion payload differs from completed run';
  end if;
  if v_run.status<>'running' then raise exception using errcode='22023',message='discovery run is not running'; end if;
  select * into v_campaign from public.marketing_sales_scout_campaigns where campaign_id=v_run.scout_campaign_id;
  if not found or v_campaign.status <> 'active' then raise exception using errcode='22023',message='discovery campaign must be active'; end if;
  if jsonb_typeof(p_payload->'providerTaskId')<>'string' or nullif(trim(p_payload->>'providerTaskId'),'') is null or length(trim(p_payload->>'providerTaskId'))>300 or jsonb_typeof(p_payload->'providerCostUsd')<>'number' or jsonb_typeof(p_payload->'rawResultCount')<>'number' or jsonb_typeof(p_payload->'candidates') is distinct from 'array' then raise exception using errcode='22023',message='discovery completion payload is invalid'; end if;
  if (p_payload->>'providerCostUsd')::numeric<0 or (p_payload->>'providerCostUsd')::numeric>999999.999999 or (p_payload->>'rawResultCount')::numeric<0 or (p_payload->>'rawResultCount')::numeric>2147483647 or trunc((p_payload->>'rawResultCount')::numeric)<>(p_payload->>'rawResultCount')::numeric then raise exception using errcode='22023',message='discovery completion payload is invalid'; end if;
  v_candidate_count:=jsonb_array_length(p_payload->'candidates');
  if v_candidate_count>v_run.requested_result_limit or (p_payload->>'rawResultCount')::integer<v_candidate_count then raise exception using errcode='22023',message='discovery completion payload is invalid'; end if;

  -- First pass: all casts are preceded by JSON type validation.
  for v_item in select value from jsonb_array_elements(p_payload->'candidates') loop
    if jsonb_typeof(v_item) <> 'object'
      or jsonb_typeof(v_item->'providerSourceId') <> 'string'
      or nullif(trim(v_item->>'providerSourceId'),'') is null
      or length(trim(v_item->>'providerSourceId')) > 300
      or jsonb_typeof(v_item->'businessName') <> 'string'
      or nullif(trim(v_item->>'businessName'),'') is null
      or length(trim(v_item->>'businessName')) > 200
      or jsonb_typeof(v_item->'normalizedBusinessName') <> 'string'
      or nullif(trim(v_item->>'normalizedBusinessName'),'') is null
      or length(trim(v_item->>'normalizedBusinessName')) > 200
      or jsonb_typeof(v_item->'observedAt') <> 'string'
      or nullif(trim(v_item->>'observedAt'),'') is null
      or jsonb_typeof(v_item->'providerCategoryIds') is distinct from 'array'
      or jsonb_typeof(v_item->'additionalCategories') is distinct from 'array'
      or jsonb_typeof(v_item->'mappingIssues') is distinct from 'array'
      or jsonb_typeof(v_item->'scoreFactors') is distinct from 'array'
    then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end if;

    foreach v_field in array array['providerCategory','mappedCampaignCategory','description','fullAddress','city','state','countryCode','phone','website','operatingStatus','normalizedCity','scoreVersion','providerSourceUrl'] loop
      if (v_item ? v_field) and jsonb_typeof(v_item->v_field) <> 'null' then
        if jsonb_typeof(v_item->v_field) <> 'string' or nullif(trim(v_item->>v_field),'') is null then
          raise exception using errcode='22023',message='discovery candidate payload is invalid';
        end if;
      end if;
    end loop;

    begin
      v_observed_at := trim(v_item->>'observedAt')::timestamptz;
    exception when others then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end;

    if (v_item ? 'countryCode') and jsonb_typeof(v_item->'countryCode') <> 'null' and length(trim(v_item->>'countryCode')) <> 2 then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end if;
    if (v_item ? 'mappedCampaignCategory') and jsonb_typeof(v_item->'mappedCampaignCategory') <> 'null' and not exists(select 1 from unnest(v_campaign.target_categories) x where lower(trim(x))=lower(trim(v_item->>'mappedCampaignCategory'))) then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end if;

    foreach v_field in array array['providerCategoryIds','additionalCategories','mappingIssues'] loop
      if jsonb_array_length(v_item->v_field)>100 or exists(select 1 from jsonb_array_elements(v_item->v_field) x where jsonb_typeof(x)<>'string' or nullif(trim(x#>>'{}'),'') is null) then
        raise exception using errcode='22023',message='discovery candidate payload is invalid';
      end if;
    end loop;

    foreach v_field in array array['preparedScore','softMatchWarningCount','ratingCount','ratingValue','latitude','longitude'] loop
      if (v_item ? v_field) and jsonb_typeof(v_item->v_field) <> 'null' and jsonb_typeof(v_item->v_field) <> 'number' then
        raise exception using errcode='22023',message='discovery candidate payload is invalid';
      end if;
    end loop;
    if (v_item ? 'claimedIndication') and jsonb_typeof(v_item->'claimedIndication') not in ('null','boolean') then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end if;

    begin
      v_prepared_score := case when jsonb_typeof(v_item->'preparedScore')='number' then (v_item->>'preparedScore')::integer end;
      v_soft_warning_count := case when jsonb_typeof(v_item->'softMatchWarningCount')='number' then (v_item->>'softMatchWarningCount')::integer else 0 end;
      v_rating_count := case when jsonb_typeof(v_item->'ratingCount')='number' then (v_item->>'ratingCount')::integer end;
      v_rating_value := case when jsonb_typeof(v_item->'ratingValue')='number' then (v_item->>'ratingValue')::numeric end;
      v_latitude := case when jsonb_typeof(v_item->'latitude')='number' then (v_item->>'latitude')::numeric end;
      v_longitude := case when jsonb_typeof(v_item->'longitude')='number' then (v_item->>'longitude')::numeric end;
      v_claimed_indication := case when jsonb_typeof(v_item->'claimedIndication')='boolean' then (v_item->>'claimedIndication')::boolean end;
    exception when numeric_value_out_of_range or invalid_text_representation then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end;
    if (jsonb_typeof(v_item->'preparedScore')='number' and ((v_item->>'preparedScore')::numeric<>trunc((v_item->>'preparedScore')::numeric) or v_prepared_score not between 0 and 100 or jsonb_typeof(v_item->'scoreVersion')<>'string' or v_item->>'scoreVersion'<>'ng-city-b2b-v1')) or ((not (v_item ? 'preparedScore') or jsonb_typeof(v_item->'preparedScore')='null') and ((v_item ? 'scoreVersion') and jsonb_typeof(v_item->'scoreVersion')<>'null')) or ((jsonb_typeof(v_item->'softMatchWarningCount')='number') and ((v_item->>'softMatchWarningCount')::numeric<>trunc((v_item->>'softMatchWarningCount')::numeric) or (v_item->>'softMatchWarningCount')::numeric not between 0 and 2147483647)) or v_soft_warning_count<0 or (v_rating_count is not null and (v_rating_count<0 or (v_item->>'ratingCount')::numeric<>trunc((v_item->>'ratingCount')::numeric))) or v_rating_value<0 or v_latitude not between -90 and 90 or v_longitude not between -180 and 180 then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end if;

    if (v_item ? 'providerSourceUrl') and jsonb_typeof(v_item->'providerSourceUrl') <> 'null' then
      v_source_url:=trim(v_item->>'providerSourceUrl');
      if v_source_url ~ '[[:space:]]' or v_source_url !~* '^https?://' then raise exception using errcode='22023',message='discovery candidate payload is invalid'; end if;
      v_source_authority:=substring(v_source_url from '^[a-zA-Z]+://([^/?#]+)');
      if coalesce(v_source_authority,'')='' or v_source_authority like '%@%' or v_source_authority like ':%' or lower(v_source_authority)='localhost' or lower(v_source_authority) like 'localhost:%' or lower(v_source_authority) like '127.%' or lower(v_source_authority)='::1' or lower(v_source_authority)='[::1]' or lower(v_source_authority) like '[::1]:%' then raise exception using errcode='22023',message='discovery candidate payload is invalid'; end if;
    end if;

    if (v_item ? 'exactMatchingProspectId') and jsonb_typeof(v_item->'exactMatchingProspectId') <> 'null' then
      if jsonb_typeof(v_item->'exactMatchingProspectId')<>'string' or nullif(trim(v_item->>'exactMatchingProspectId'),'') is null then raise exception using errcode='22023',message='discovery candidate payload is invalid'; end if;
      begin
        v_exact_id:=trim(v_item->>'exactMatchingProspectId')::uuid;
      exception when invalid_text_representation then
        raise exception using errcode='22023',message='discovery candidate payload is invalid';
      end;
      if not exists(select 1 from public.marketing_prospects where id=v_exact_id) then raise exception using errcode='22023',message='discovery candidate payload is invalid'; end if;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_payload->'candidates') x group by lower(trim(x->>'providerSourceId')) having count(*)>1) then raise exception using errcode='22023',message='discovery completion contains duplicate provider identities'; end if;

  -- Second pass: persist every validated canonical field and one membership row.
for v_item in select value from jsonb_array_elements(p_payload->'candidates') loop
    select coalesce(jsonb_agg(to_jsonb(trim(value_text)) order by ordinality),'[]'::jsonb)
    into v_provider_category_ids
    from jsonb_array_elements_text(v_item->'providerCategoryIds') with ordinality a(value_text, ordinality);
    select coalesce(jsonb_agg(to_jsonb(trim(value_text)) order by ordinality),'[]'::jsonb)
    into v_additional_categories
    from jsonb_array_elements_text(v_item->'additionalCategories') with ordinality a(value_text, ordinality);
    select coalesce(jsonb_agg(to_jsonb(trim(value_text)) order by ordinality),'[]'::jsonb)
    into v_mapping_issues
    from jsonb_array_elements_text(v_item->'mappingIssues') with ordinality a(value_text, ordinality);
    v_exact_id:=nullif(trim(v_item->>'exactMatchingProspectId'),'')::uuid;
    v_exact:=v_exact_id is not null;
    insert into public.marketing_sales_scout_discovery_candidates(discovery_run_id,last_discovery_run_id,scout_campaign_id,provider,provider_source_id,business_name,provider_category,mapped_campaign_category,provider_category_ids,additional_categories,mapping_issues,provider_source_url,public_description,full_address,city,state,country_code,latitude,longitude,public_phone,public_website,rating_value,rating_count,claimed_indication,operating_status,observed_at,normalized_business_name,normalized_city,prepared_score,score_version,score_factors,exact_matching_prospect_id,soft_match_warning_count,status) values(v_run.id,v_run.id,v_run.scout_campaign_id,'dataforseo_business_listings',trim(v_item->>'providerSourceId'),trim(v_item->>'businessName'),nullif(trim(v_item->>'providerCategory'),''),nullif(trim(v_item->>'mappedCampaignCategory'),''),v_provider_category_ids,v_additional_categories,v_mapping_issues,nullif(trim(v_item->>'providerSourceUrl'),''),nullif(trim(v_item->>'description'),''),nullif(trim(v_item->>'fullAddress'),''),nullif(trim(v_item->>'city'),''),nullif(trim(v_item->>'state'),''),nullif(trim(v_item->>'countryCode'),''),nullif(v_item->>'latitude','')::numeric,nullif(v_item->>'longitude','')::numeric,nullif(trim(v_item->>'phone'),''),nullif(trim(v_item->>'website'),''),nullif(v_item->>'ratingValue','')::numeric,nullif(v_item->>'ratingCount','')::integer,nullif(v_item->>'claimedIndication','')::boolean,nullif(trim(v_item->>'operatingStatus'),''),(v_item->>'observedAt')::timestamptz,trim(v_item->>'normalizedBusinessName'),nullif(trim(v_item->>'normalizedCity'),''),nullif(v_item->>'preparedScore','')::integer,nullif(trim(v_item->>'scoreVersion'),''),v_item->'scoreFactors',v_exact_id,coalesce((v_item->>'softMatchWarningCount')::integer,0),case when v_exact then 'duplicate' else 'new' end) on conflict(scout_campaign_id,provider,provider_source_id) do update set last_discovery_run_id=excluded.last_discovery_run_id,last_seen_at=now(),seen_count=marketing_sales_scout_discovery_candidates.seen_count+1,business_name=excluded.business_name,provider_category=excluded.provider_category,mapped_campaign_category=excluded.mapped_campaign_category,provider_category_ids=excluded.provider_category_ids,additional_categories=excluded.additional_categories,mapping_issues=excluded.mapping_issues,provider_source_url=excluded.provider_source_url,public_description=excluded.public_description,full_address=excluded.full_address,city=excluded.city,state=excluded.state,country_code=excluded.country_code,latitude=excluded.latitude,longitude=excluded.longitude,public_phone=excluded.public_phone,public_website=excluded.public_website,rating_value=excluded.rating_value,rating_count=excluded.rating_count,claimed_indication=excluded.claimed_indication,operating_status=excluded.operating_status,observed_at=excluded.observed_at,normalized_business_name=excluded.normalized_business_name,normalized_city=excluded.normalized_city,prepared_score=excluded.prepared_score,score_version=excluded.score_version,score_factors=excluded.score_factors,exact_matching_prospect_id=excluded.exact_matching_prospect_id,soft_match_warning_count=excluded.soft_match_warning_count,status=case when marketing_sales_scout_discovery_candidates.status in('captured','dismissed') then marketing_sales_scout_discovery_candidates.status when excluded.exact_matching_prospect_id is not null then 'duplicate' when marketing_sales_scout_discovery_candidates.status='reviewing' then 'reviewing' else 'new' end returning id into v_candidate_id;
    insert into public.marketing_sales_scout_discovery_run_candidates(discovery_run_id,candidate_id,is_exact_duplicate,exact_matching_prospect_id,soft_match_warning_count) values(v_run.id,v_candidate_id,v_exact,v_exact_id,coalesce((v_item->>'softMatchWarningCount')::integer,0)) on conflict do nothing;
  end loop;
  select count(*),count(*) filter(where is_exact_duplicate) into v_staged,v_exact_count from public.marketing_sales_scout_discovery_run_candidates where discovery_run_id=v_run.id;
  update public.marketing_sales_scout_discovery_runs set status='completed',provider_task_id=trim(p_payload->>'providerTaskId'),provider_cost_usd=(p_payload->>'providerCostUsd')::numeric,raw_result_count=(p_payload->>'rawResultCount')::integer,staged_candidate_count=v_staged,exact_duplicate_count=v_exact_count,completion_payload_fingerprint=v_fingerprint,completed_at=now(),updated_at=now() where id=v_run.id;
  return jsonb_build_object('runId',v_run.id,'status','completed','stagedCandidateCount',v_staged,'exactDuplicateCount',v_exact_count);
end;
$$;
create or replace function public.fail_sales_scout_discovery_run(p_run_id uuid,p_error_reference text,p_error_safe_message text,p_actor_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_run public.marketing_sales_scout_discovery_runs%rowtype;
begin
 if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for discovery failure'; end if;
 p_error_reference:=trim(p_error_reference); p_error_safe_message:=trim(p_error_safe_message); if nullif(p_error_reference,'') is null or length(p_error_reference)>120 or nullif(p_error_safe_message,'') is null or length(p_error_safe_message)>500 then raise exception using errcode='22023',message='discovery failure details are required'; end if;
 select * into v_run from public.marketing_sales_scout_discovery_runs where id=p_run_id for update; if not found then raise exception using errcode='P0002',message='discovery run not found'; end if;
 if v_run.status='failed' and v_run.error_reference=p_error_reference and v_run.error_safe_message=p_error_safe_message then return jsonb_build_object('runId',v_run.id,'status','failed'); end if;
 if v_run.status<>'running' then raise exception using errcode='22023',message='discovery run is not running'; end if;
 update public.marketing_sales_scout_discovery_runs set status='failed',error_reference=p_error_reference,error_safe_message=p_error_safe_message,completed_at=now(),updated_at=now() where id=v_run.id;
 return jsonb_build_object('runId',v_run.id,'status','failed');
end $$;
revoke all on function public.start_sales_scout_discovery_run(uuid,text[],integer,uuid),public.complete_sales_scout_discovery_run(uuid,jsonb,uuid),public.fail_sales_scout_discovery_run(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.start_sales_scout_discovery_run(uuid,text[],integer,uuid),public.complete_sales_scout_discovery_run(uuid,jsonb,uuid),public.fail_sales_scout_discovery_run(uuid,text,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;