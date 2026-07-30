begin;

alter table public.marketing_sales_scout_campaigns
  add column if not exists discovery_latitude numeric,
  add column if not exists discovery_longitude numeric,
  add column if not exists discovery_radius_km integer,
  add column if not exists discovery_default_limit integer;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='marketing_sales_scout_campaigns_discovery_latitude_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_latitude_check check (discovery_latitude is null or discovery_latitude between -90 and 90);
  end if;
  if not exists(select 1 from pg_constraint where conname='marketing_sales_scout_campaigns_discovery_longitude_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_longitude_check check (discovery_longitude is null or discovery_longitude between -180 and 180);
  end if;
  if not exists(select 1 from pg_constraint where conname='marketing_sales_scout_campaigns_discovery_radius_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_radius_check check (discovery_radius_km is null or discovery_radius_km between 1 and 100);
  end if;
  if not exists(select 1 from pg_constraint where conname='marketing_sales_scout_campaigns_discovery_limit_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_limit_check check (discovery_default_limit is null or discovery_default_limit between 1 and 50);
  end if;
end $$;

update public.marketing_sales_scout_campaigns
set discovery_latitude=coalesce(discovery_latitude,6.5244),
    discovery_longitude=coalesce(discovery_longitude,3.3792),
    discovery_radius_km=coalesce(discovery_radius_km,40),
    discovery_default_limit=coalesce(discovery_default_limit,25)
where lower(trim(city))='lagos' and lower(trim(country))='nigeria';

create table if not exists public.marketing_sales_scout_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  scout_campaign_id uuid not null references public.marketing_sales_scout_campaigns(campaign_id) on delete cascade,
  provider text not null check (provider='dataforseo_business_listings'),
  status text not null check (status in ('running','completed','failed')),
  requested_categories text[] not null default '{}',
  requested_result_limit integer not null check (requested_result_limit between 1 and 50),
  latitude numeric not null check (latitude between -90 and 90),
  longitude numeric not null check (longitude between -180 and 180),
  radius_km integer not null check (radius_km between 1 and 100),
  provider_task_id text,
  provider_cost_usd numeric(12,6),
  raw_result_count integer not null default 0 check (raw_result_count >= 0),
  staged_candidate_count integer not null default 0 check (staged_candidate_count >= 0),
  exact_duplicate_count integer not null default 0 check (exact_duplicate_count >= 0),
  error_reference text,
  error_safe_message text,
  started_by uuid not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_sales_scout_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  discovery_run_id uuid not null references public.marketing_sales_scout_discovery_runs(id) on delete cascade,
  scout_campaign_id uuid not null references public.marketing_sales_scout_campaigns(campaign_id) on delete cascade,
  provider text not null check (provider='dataforseo_business_listings'),
  provider_source_id text not null,
  status text not null default 'new' check (status in ('new','reviewing','duplicate','captured','dismissed')),
  business_name text not null,
  provider_category text,
  mapped_campaign_category text,
  public_description text,
  full_address text,
  city text,
  state text,
  country text,
  latitude numeric,
  longitude numeric,
  public_phone text,
  public_website text,
  rating_value numeric,
  rating_count integer,
  claimed_indication boolean,
  provider_source_url text,
  observed_at timestamptz not null,
  normalized_business_name text not null,
  normalized_city text not null,
  prepared_score integer,
  score_version text,
  score_factors jsonb not null default '[]'::jsonb,
  exact_matching_prospect_id uuid references public.marketing_prospects(id) on delete set null,
  soft_match_warning_count integer not null default 0,
  captured_prospect_id uuid references public.marketing_prospects(id) on delete set null,
  dismissal_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketing_sales_scout_discovery_candidates_identity_uidx
  on public.marketing_sales_scout_discovery_candidates(scout_campaign_id,provider,provider_source_id);
create index if not exists marketing_sales_scout_discovery_runs_campaign_idx
  on public.marketing_sales_scout_discovery_runs(scout_campaign_id,started_at desc);
create index if not exists marketing_sales_scout_discovery_candidates_review_idx
  on public.marketing_sales_scout_discovery_candidates(scout_campaign_id,status,created_at desc);

alter table public.marketing_sales_scout_discovery_runs enable row level security;
alter table public.marketing_sales_scout_discovery_candidates enable row level security;
revoke all on table public.marketing_sales_scout_discovery_runs from public,anon,authenticated;
revoke all on table public.marketing_sales_scout_discovery_candidates from public,anon,authenticated;
grant all on table public.marketing_sales_scout_discovery_runs to service_role;
grant all on table public.marketing_sales_scout_discovery_candidates to service_role;

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
  v_item jsonb;
  v_candidate_id uuid;
  v_staged integer:=0;
  v_exact integer:=0;
  v_raw integer;
  v_cost numeric;
  v_task text;
  v_status text;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for discovery completion'; end if;
  select * into v_run from public.marketing_sales_scout_discovery_runs where id=p_run_id for update;
  if not found then raise exception using errcode='P0002',message='discovery run not found'; end if;
  if not exists(select 1 from public.marketing_sales_scout_campaigns where campaign_id=v_run.scout_campaign_id and status='active') then
    raise exception using errcode='22023',message='discovery campaign must be active';
  end if;
  if v_run.status='completed' then
    if coalesce(p_payload->>'rawResultCount','')=v_run.raw_result_count::text
      and coalesce(p_payload->>'providerCostUsd','')=coalesce(v_run.provider_cost_usd::text,'')
      and coalesce(p_payload->>'providerTaskId','')=coalesce(v_run.provider_task_id,'') then
      return jsonb_build_object('runId',v_run.id,'status',v_run.status,'stagedCandidateCount',v_run.staged_candidate_count,'exactDuplicateCount',v_run.exact_duplicate_count);
    end if;
    raise exception using errcode='22023',message='discovery run is already completed';
  end if;
  if v_run.status<>'running' then raise exception using errcode='22023',message='discovery run is not running'; end if;
  v_raw:=coalesce((p_payload->>'rawResultCount')::integer,0);
  v_cost:=nullif(p_payload->>'providerCostUsd','')::numeric;
  v_task:=nullif(p_payload->>'providerTaskId','');
  if v_raw<0 or v_raw>10000 or v_cost<0 then raise exception using errcode='22023',message='discovery completion counters are invalid'; end if;
  if jsonb_typeof(p_payload->'candidates') is distinct from 'array' then raise exception using errcode='22023',message='discovery candidates payload is invalid'; end if;
  for v_item in select value from jsonb_array_elements(p_payload->'candidates') loop
    insert into public.marketing_sales_scout_discovery_candidates(
      discovery_run_id,scout_campaign_id,provider,provider_source_id,business_name,provider_category,
      mapped_campaign_category,public_description,full_address,city,state,country,latitude,longitude,
      public_phone,public_website,rating_value,rating_count,claimed_indication,provider_source_url,
      observed_at,normalized_business_name,normalized_city,prepared_score,score_version,score_factors,
      exact_matching_prospect_id,soft_match_warning_count
    ) values (
      v_run.id,v_run.scout_campaign_id,'dataforseo_business_listings',nullif(v_item->>'providerSourceId',''),
      coalesce(nullif(v_item->>'businessName',''),'Unknown business'),nullif(v_item->>'providerCategory',''),
      nullif(v_item->>'mappedCampaignCategory',''),nullif(v_item->>'publicDescription',''),
      nullif(v_item->>'fullAddress',''),nullif(v_item->>'city',''),nullif(v_item->>'state',''),
      nullif(v_item->>'country',''),nullif(v_item->>'latitude','')::numeric,nullif(v_item->>'longitude','')::numeric,
      nullif(v_item->>'publicPhone',''),nullif(v_item->>'publicWebsite',''),
      nullif(v_item->>'ratingValue','')::numeric,nullif(v_item->>'ratingCount','')::integer,
      nullif(v_item->>'claimedIndication','')::boolean,nullif(v_item->>'providerSourceUrl',''),
      (v_item->>'observedAt')::timestamptz,coalesce(nullif(v_item->>'normalizedBusinessName',''),'unknown'),
      coalesce(nullif(v_item->>'normalizedCity',''),'unknown'),nullif(v_item->>'preparedScore','')::integer,
      nullif(v_item->>'scoreVersion',''),coalesce(v_item->'scoreFactors','[]'::jsonb),
      nullif(v_item->>'exactMatchingProspectId','')::uuid,coalesce((v_item->>'softMatchWarningCount')::integer,0)
    )
    on conflict(scout_campaign_id,provider,provider_source_id) do update set
      discovery_run_id=excluded.discovery_run_id,business_name=excluded.business_name,
      provider_category=excluded.provider_category,mapped_campaign_category=excluded.mapped_campaign_category,
      public_description=excluded.public_description,full_address=excluded.full_address,city=excluded.city,
      state=excluded.state,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,
      public_phone=excluded.public_phone,public_website=excluded.public_website,rating_value=excluded.rating_value,
      rating_count=excluded.rating_count,claimed_indication=excluded.claimed_indication,
      provider_source_url=excluded.provider_source_url,observed_at=excluded.observed_at,
      normalized_business_name=excluded.normalized_business_name,normalized_city=excluded.normalized_city,
      prepared_score=excluded.prepared_score,score_version=excluded.score_version,score_factors=excluded.score_factors,
      exact_matching_prospect_id=excluded.exact_matching_prospect_id,soft_match_warning_count=excluded.soft_match_warning_count,
      updated_at=now()
    where marketing_sales_scout_discovery_candidates.status not in ('captured','dismissed')
    returning id,status into v_candidate_id,v_status;
    if v_candidate_id is not null then v_staged:=v_staged+1; if v_item->>'exactMatchingProspectId' is not null then v_exact:=v_exact+1; end if; end if;
  end loop;
  update public.marketing_sales_scout_discovery_runs set
    status='completed',provider_task_id=v_task,provider_cost_usd=v_cost,raw_result_count=v_raw,
    staged_candidate_count=v_staged,exact_duplicate_count=v_exact,completed_at=now(),updated_at=now()
  where id=v_run.id;
  return jsonb_build_object('runId',v_run.id,'status','completed','stagedCandidateCount',v_staged,'exactDuplicateCount',v_exact);
end;
$$;

revoke all on function public.complete_sales_scout_discovery_run(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.complete_sales_scout_discovery_run(uuid,jsonb,uuid) to service_role;

notify pgrst,'reload schema';
commit;