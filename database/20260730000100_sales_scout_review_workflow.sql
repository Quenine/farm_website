begin;

alter table public.marketing_prospects add column if not exists scout_campaign_id uuid;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.marketing_prospects'::regclass and conname='marketing_prospects_scout_campaign_id_fkey') then
    alter table public.marketing_prospects add constraint marketing_prospects_scout_campaign_id_fkey
      foreign key(scout_campaign_id) references public.marketing_sales_scout_campaigns(campaign_id) on delete restrict;
  end if;
end $$;
create index if not exists marketing_prospects_scout_campaign_idx
  on public.marketing_prospects(scout_campaign_id,scout_status,created_at desc)
  where scout_campaign_id is not null and scout_status is not null;
update public.marketing_prospects prospect set scout_campaign_id=prospect.campaign_id
where prospect.scout_status is not null and prospect.scout_campaign_id is null
  and exists(select 1 from public.marketing_sales_scout_campaigns scout where scout.campaign_id=prospect.campaign_id);

create or replace function public.capture_sales_scout_candidate(
  p_payload jsonb,
  p_resolution text,
  p_existing_prospect_id uuid default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign_id uuid;
  v_prospect_id uuid;
  v_exact_ids uuid[];
  v_channel jsonb;
  v_inserted integer := 0;
  v_is_primary boolean;
  v_has_primary boolean := false;
  v_activity_id uuid;
  v_score integer;
  v_scored_at timestamptz;
  v_prospect public.marketing_prospects%rowtype;
  v_enrolled boolean := false;
begin
  if p_actor_id is null then
    raise exception using errcode = '22023', message = 'actor id is required for candidate capture';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'candidate payload must be an object';
  end if;
  if p_resolution not in ('create_new', 'attach_to_existing') then
    raise exception using errcode = '22023', message = 'invalid candidate resolution';
  end if;
  if p_resolution = 'attach_to_existing' and p_existing_prospect_id is null then
    raise exception using errcode = '22023', message = 'existing prospect id is required for attachment';
  end if;
  if nullif(trim(p_payload->>'businessName'), '') is null
    or nullif(trim(p_payload->>'businessCategory'), '') is null
    or nullif(trim(p_payload->>'city'), '') is null
    or nullif(trim(p_payload->>'country'), '') is null
    or nullif(trim(p_payload->>'provider'), '') is null
    or nullif(trim(p_payload->>'sourceUrl'), '') is null
    or jsonb_typeof(p_payload->'channels') is distinct from 'array'
    or jsonb_array_length(p_payload->'channels') = 0
    or jsonb_typeof(p_payload->'score') is distinct from 'object' then
    raise exception using errcode = '22023', message = 'candidate payload is incomplete';
  end if;

  if jsonb_typeof(p_payload->'score'->'score') is distinct from 'number'
    or (p_payload->'score'->>'score') !~ '^\d+$'
    or (p_payload->'score'->>'score')::numeric not between 0 and 100
    or p_payload->'score'->>'ruleVersion' <> 'ng-city-b2b-v1'
    or jsonb_typeof(p_payload->'score'->'factors') is distinct from 'array'
    or nullif(p_payload->'score'->>'scoredAt', '') is null then
    raise exception using errcode = '22023', message = 'candidate score payload is invalid';
  end if;
  begin
    v_score := (p_payload->'score'->>'score')::integer;
    v_scored_at := (p_payload->'score'->>'scoredAt')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'candidate score payload is invalid';
  end;

  begin
    v_campaign_id := (p_payload->>'campaignId')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'candidate campaign id is invalid';
  end;

  perform 1
  from public.marketing_sales_scout_campaigns
  where campaign_id = v_campaign_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Sales Scout campaign not found';
  end if;

  select coalesce(array_agg(distinct match_id), '{}'::uuid[])
  into v_exact_ids
  from (
    select c.prospect_id as match_id
    from public.marketing_prospect_channels c
    join jsonb_array_elements(p_payload->'channels') candidate
      on c.platform = candidate->>'platform'
      and c.identity_key = candidate->>'identityKey'
    where c.is_active
    union
    select c.prospect_id
    from public.marketing_prospect_channels c
    join jsonb_array_elements(p_payload->'channels') candidate
      on c.source = p_payload->>'provider'
      and c.source_id = candidate->>'sourceId'
    where nullif(candidate->>'sourceId', '') is not null
    union
    select p.id
    from public.marketing_prospects p
    where nullif(p_payload->>'providerSourceId', '') is not null
      and p.discovery_source = p_payload->>'provider'
      and p.discovery_source_id = p_payload->>'providerSourceId'
  ) matches;

  if cardinality(v_exact_ids) > 1 then
    raise exception using errcode = '23000', message = 'candidate identities match multiple prospects';
  end if;
  if cardinality(v_exact_ids) = 1 then
    if p_resolution = 'create_new' then
      return jsonb_build_object('outcome','exact_existing','prospect_id',v_exact_ids[1],
        'channels_inserted',0,'exact_duplicate_reason','existing exact identity',
        'activity_id',null,'existing_prospect_enrolled',false);
    end if;
    if p_existing_prospect_id is distinct from v_exact_ids[1] then
      raise exception using errcode='22023',message='selected attachment target does not own the exact identity';
    end if;
    v_prospect_id := v_exact_ids[1];
  end if;

  if p_resolution = 'attach_to_existing' then
    v_prospect_id := coalesce(v_prospect_id,p_existing_prospect_id);
    select * into v_prospect from public.marketing_prospects where id=v_prospect_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'prospect not found';
    end if;
    select exists (
      select 1 from public.marketing_prospect_channels
      where prospect_id = v_prospect_id and is_active and is_primary
    ) into v_has_primary;
    if v_prospect.scout_status is not null and v_prospect.scout_campaign_id is distinct from v_campaign_id then
      raise exception using errcode='22023',message='existing Scout prospect belongs to a different Scout campaign';
    end if;
    if v_prospect.scout_status is null then
      update public.marketing_prospects set
        scout_campaign_id=v_campaign_id,
        scout_status=case when do_not_contact_at is null then 'new' else 'do_not_contact' end,
        business_category=coalesce(business_category,trim(p_payload->>'businessCategory')),
        city=coalesce(city,trim(p_payload->>'city')),state=coalesce(state,nullif(trim(p_payload->>'state'),'')),
        country=coalesce(country,trim(p_payload->>'country')),
        service_area_cities=coalesce(service_area_cities,array(select jsonb_array_elements_text(p_payload->'serviceAreaCities'))),
        location_evidence=coalesce(location_evidence,jsonb_build_object('source_url',p_payload->>'sourceUrl','observed_at',p_payload->>'observedAt')),
        discovery_source=coalesce(discovery_source,trim(p_payload->>'provider')),
        discovery_source_id=coalesce(discovery_source_id,nullif(trim(p_payload->>'providerSourceId'),'')),
        source_url=coalesce(source_url,p_payload->>'sourceUrl'),discovered_at=coalesce(discovered_at,(p_payload->>'observedAt')::timestamptz),
        profile_last_activity_at=coalesce(profile_last_activity_at,nullif(p_payload->>'mostRecentPublicActivityAt','')::timestamptz),
        has_recurring_produce_demand=coalesce(has_recurring_produce_demand,nullif(p_payload->>'recurringProduceDemandEvidence','') is not null),
        recurring_demand_evidence=coalesce(recurring_demand_evidence,nullif(trim(p_payload->>'recurringProduceDemandEvidence'),'')),
        demand_band=coalesce(demand_band,p_payload->>'demandBand'),
        appears_inactive_or_closed=coalesce(appears_inactive_or_closed,(p_payload->>'isInactiveOrClosed')::boolean),
        is_consumer_only=coalesce(is_consumer_only,(p_payload->>'isConsumerOnly')::boolean),
        score=coalesce(score,v_score),score_version=coalesce(score_version,p_payload->'score'->>'ruleVersion'),
        score_factors=coalesce(score_factors,p_payload->'score'->'factors'),scored_at=coalesce(scored_at,v_scored_at),updated_at=now()
      where id=v_prospect_id;
      v_enrolled := true;
    end if;
  else
    insert into public.marketing_prospects (
      business_name, business_category, stage, source, campaign_id, scout_campaign_id, scout_status,
      city, state, country, location_evidence, service_area_cities,
      discovery_source, discovery_source_id, source_url, discovered_at,
      profile_last_activity_at, has_recurring_produce_demand,
      recurring_demand_evidence, demand_band, appears_inactive_or_closed,
      is_consumer_only, score, score_version, score_factors, scored_at, created_by
    ) values (
      trim(p_payload->>'businessName'), trim(p_payload->>'businessCategory'),
      'identified', 'sales_scout', v_campaign_id, v_campaign_id, 'new',
      trim(p_payload->>'city'), nullif(trim(p_payload->>'state'), ''),
      trim(p_payload->>'country'),
      jsonb_build_object('source_url', p_payload->>'sourceUrl', 'observed_at', p_payload->>'observedAt'),
      coalesce(array(select jsonb_array_elements_text(p_payload->'serviceAreaCities')), '{}'::text[]),
      trim(p_payload->>'provider'), nullif(trim(p_payload->>'providerSourceId'), ''),
      p_payload->>'sourceUrl', (p_payload->>'observedAt')::timestamptz,
      nullif(p_payload->>'mostRecentPublicActivityAt', '')::timestamptz,
      nullif(p_payload->>'recurringProduceDemandEvidence', '') is not null,
      nullif(trim(p_payload->>'recurringProduceDemandEvidence'), ''),
      p_payload->>'demandBand', (p_payload->>'isInactiveOrClosed')::boolean,
      (p_payload->>'isConsumerOnly')::boolean, v_score,
      p_payload->'score'->>'ruleVersion', p_payload->'score'->'factors',
      v_scored_at, p_actor_id
    )
    returning id into v_prospect_id;
  end if;

  for v_channel in select value from jsonb_array_elements(p_payload->'channels')
  loop
    if exists(select 1 from public.marketing_prospect_channels c where c.prospect_id=v_prospect_id
      and ((c.is_active and c.platform=v_channel->>'platform' and c.identity_key=v_channel->>'identityKey')
        or (nullif(v_channel->>'sourceId','') is not null and c.source=p_payload->>'provider' and c.source_id=v_channel->>'sourceId'))) then
      continue;
    end if;
    v_is_primary := (v_channel->>'isPrimary')::boolean and not v_has_primary;
    insert into public.marketing_prospect_channels (
      prospect_id, platform, handle_or_value, identity_key, profile_url,
      is_primary, source, source_id, evidence, created_by
    ) values (
      v_prospect_id, v_channel->>'platform', v_channel->>'handleOrValue',
      v_channel->>'identityKey', nullif(v_channel->>'profileUrl', ''),
      v_is_primary, p_payload->>'provider', nullif(v_channel->>'sourceId', ''),
      coalesce(v_channel->'evidence', '{}'::jsonb), p_actor_id
    );
    v_inserted := v_inserted + 1;
    v_has_primary := v_has_primary or v_is_primary;
  end loop;

  if p_resolution='attach_to_existing' and not v_enrolled and v_inserted=0 then
    return jsonb_build_object('outcome','exact_existing','prospect_id',v_prospect_id,
      'channels_inserted',0,'exact_duplicate_reason','candidate already fully attached',
      'activity_id',null,'existing_prospect_enrolled',false);
  end if;

  if p_resolution = 'create_new' and v_inserted = 0 then
    raise exception using errcode = '23000', message = 'new candidate requires at least one inserted channel';
  end if;

  insert into public.marketing_prospect_activities (
    prospect_id, activity_type, summary, occurred_at, created_by, metadata
  ) values (
    v_prospect_id, 'sales_scout',
    case when p_resolution = 'create_new'
      then 'Sales Scout candidate captured.'
      else 'Sales Scout candidate attached to existing prospect.'
    end,
    (p_payload->>'observedAt')::timestamptz, p_actor_id,
    jsonb_build_object(
      'event', case when p_resolution = 'create_new' then 'scout_captured' else 'candidate_attached' end,
      'provider', p_payload->>'provider',
      'source_url', p_payload->>'sourceUrl',
      'channels_inserted', v_inserted,
      'existing_prospect_enrolled',v_enrolled
    )
  )
  returning id into v_activity_id;

  return jsonb_build_object(
    'outcome', case when p_resolution = 'create_new' then 'created' else 'attached' end,
    'prospect_id', v_prospect_id,
    'channels_inserted', v_inserted,
    'exact_duplicate_reason', null,
    'activity_id', v_activity_id,
    'existing_prospect_enrolled',v_enrolled
  );
exception
  when unique_violation then
    select coalesce(array_agg(distinct match_id), '{}'::uuid[])
    into v_exact_ids
    from (
      select c.prospect_id as match_id
      from public.marketing_prospect_channels c
      join jsonb_array_elements(p_payload->'channels') candidate
        on c.platform = candidate->>'platform'
        and c.identity_key = candidate->>'identityKey'
      where c.is_active
      union
      select c.prospect_id
      from public.marketing_prospect_channels c
      join jsonb_array_elements(p_payload->'channels') candidate
        on c.source = p_payload->>'provider'
        and c.source_id = candidate->>'sourceId'
      where nullif(candidate->>'sourceId', '') is not null
      union
      select p.id
      from public.marketing_prospects p
      where nullif(p_payload->>'providerSourceId', '') is not null
        and p.discovery_source = p_payload->>'provider'
        and p.discovery_source_id = p_payload->>'providerSourceId'
    ) matches;
    if cardinality(v_exact_ids) > 1 then
      raise exception using errcode = '23000', message = 'candidate identities match multiple prospects';
    end if;
    if cardinality(v_exact_ids) = 1 then
      return jsonb_build_object(
        'outcome', 'exact_existing',
        'prospect_id', v_exact_ids[1],
        'channels_inserted', 0,
        'exact_duplicate_reason', 'concurrent exact identity capture',
        'activity_id', null,
        'existing_prospect_enrolled',false
      );
    end if;
    raise exception using errcode = '40001', message = 'candidate capture conflicted concurrently';
end;
$$;

create or replace function public.update_sales_scout_qualification_facts(
  p_payload jsonb,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prospect public.marketing_prospects%rowtype;
  v_prospect_id uuid;
  v_campaign_id uuid;
  v_score integer;
  v_scored_at timestamptz;
  v_activity_at timestamptz;
  v_activity_id uuid;
begin
  if p_actor_id is null then
    raise exception using errcode = '22023', message = 'actor id is required for qualification update';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'qualification payload must be an object';
  end if;
  begin
    v_prospect_id := (p_payload->>'prospectId')::uuid;
    v_campaign_id := (p_payload->>'campaignId')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'qualification prospect and campaign ids are invalid';
  end;
  if v_prospect_id is null or v_campaign_id is null then
    raise exception using errcode = '22023', message = 'qualification prospect and campaign ids are invalid';
  end if;
  if nullif(trim(p_payload->>'businessCategory'), '') is null
    or nullif(trim(p_payload->>'city'), '') is null
    or nullif(trim(p_payload->>'country'), '') is null
    or nullif(trim(p_payload->>'sourceUrl'), '') is null
    or jsonb_typeof(p_payload->'serviceAreaCities') is distinct from 'array'
    or jsonb_typeof(p_payload->'locationEvidence') is distinct from 'object'
    or p_payload->>'demandBand' not in ('high','medium','low','unknown')
    or jsonb_typeof(p_payload->'isInactiveOrClosed') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'isConsumerOnly') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'score') is distinct from 'object' then
    raise exception using errcode = '22023', message = 'qualification payload is incomplete';
  end if;
  if jsonb_typeof(p_payload->'score'->'score') is distinct from 'number'
    or (p_payload->'score'->>'score') !~ '^\d+$'
    or (p_payload->'score'->>'score')::numeric not between 0 and 100
    or p_payload->'score'->>'ruleVersion' <> 'ng-city-b2b-v1'
    or jsonb_typeof(p_payload->'score'->'factors') is distinct from 'array'
    or nullif(p_payload->'score'->>'scoredAt', '') is null then
    raise exception using errcode = '22023', message = 'qualification score payload is invalid';
  end if;
  begin
    v_score := (p_payload->'score'->>'score')::integer;
    v_scored_at := (p_payload->'score'->>'scoredAt')::timestamptz;
    v_activity_at := nullif(p_payload->>'mostRecentPublicActivityAt', '')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'qualification timestamps are invalid';
  end;

  select * into v_prospect
  from public.marketing_prospects
  where id = v_prospect_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'prospect not found';
  end if;
  if v_prospect.scout_status is null then
    raise exception using errcode = '22023', message = 'prospect is not a Sales Scout prospect';
  end if;
  if v_prospect.scout_campaign_id is distinct from v_campaign_id then
    raise exception using errcode = '22023', message = 'prospect campaign does not match qualification campaign';
  end if;
  perform 1 from public.marketing_sales_scout_campaigns
  where campaign_id = v_campaign_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Sales Scout campaign not found';
  end if;

  update public.marketing_prospects set
    business_category = trim(p_payload->>'businessCategory'),
    city = trim(p_payload->>'city'),
    state = nullif(trim(p_payload->>'state'), ''),
    country = trim(p_payload->>'country'),
    service_area_cities = coalesce(
      array(select jsonb_array_elements_text(p_payload->'serviceAreaCities')),
      '{}'::text[]
    ),
    profile_last_activity_at = v_activity_at,
    has_recurring_produce_demand = nullif(trim(p_payload->>'recurringProduceDemandEvidence'), '') is not null,
    recurring_demand_evidence = nullif(trim(p_payload->>'recurringProduceDemandEvidence'), ''),
    demand_band = p_payload->>'demandBand',
    appears_inactive_or_closed = (p_payload->>'isInactiveOrClosed')::boolean,
    is_consumer_only = (p_payload->>'isConsumerOnly')::boolean,
    source_url = p_payload->>'sourceUrl',
    location_evidence = p_payload->'locationEvidence',
    score = v_score,
    score_version = p_payload->'score'->>'ruleVersion',
    score_factors = p_payload->'score'->'factors',
    scored_at = v_scored_at,
    updated_at = now()
  where id = v_prospect_id;

  insert into public.marketing_prospect_activities (
    prospect_id, activity_type, summary, occurred_at, created_by, metadata
  ) values (
    v_prospect_id, 'sales_scout', 'Sales Scout qualification facts and score updated.',
    v_scored_at, p_actor_id,
    jsonb_build_object(
      'event', 'scout_scored',
      'score', v_score,
      'score_version', p_payload->'score'->>'ruleVersion'
    )
  ) returning id into v_activity_id;

  return jsonb_build_object(
    'prospect_id', v_prospect_id,
    'score', v_score,
    'rule_version', p_payload->'score'->>'ruleVersion',
    'activity_id', v_activity_id
  );
end;
$$;

create or replace function public.transition_sales_scout_review_status(
  p_payload jsonb,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prospect public.marketing_prospects%rowtype;
  v_prospect_id uuid;
  v_target text;
  v_reason text;
  v_activity_id uuid;
  v_campaign public.marketing_sales_scout_campaigns%rowtype;
begin
  if p_actor_id is null then
    raise exception using errcode='22023', message='actor id is required for Scout review transition';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode='22023', message='review transition payload must be an object';
  end if;
  begin
    v_prospect_id := (p_payload->>'prospectId')::uuid;
  exception when others then
    raise exception using errcode='22023', message='prospect id is invalid';
  end;
  v_target := p_payload->>'targetStatus';
  v_reason := nullif(trim(p_payload->>'reason'), '');
  if v_prospect_id is null or v_target not in ('new','researching','qualified','disqualified','closed') then
    raise exception using errcode='22023', message='review target status is invalid';
  end if;
  if v_target in ('disqualified','closed') and v_reason is null then
    raise exception using errcode='22023', message='reason is required for disqualified or closed status';
  end if;

  select * into v_prospect from public.marketing_prospects
  where id=v_prospect_id for update;
  if not found then raise exception using errcode='P0002', message='prospect not found'; end if;
  if v_prospect.scout_status is null then
    raise exception using errcode='22023', message='prospect is not a Sales Scout prospect';
  end if;
  if v_prospect.scout_status='do_not_contact' and v_target <> 'do_not_contact' then
    raise exception using errcode='22023', message='do-not-contact prospect cannot leave suppression';
  end if;
  if v_prospect.scout_status=v_target then
    return jsonb_build_object('changed',false,'prospect_id',v_prospect_id,
      'previous_status',v_target,'current_status',v_target,'activity_id',null);
  end if;

  if v_target='qualified' then
    select * into v_campaign from public.marketing_sales_scout_campaigns
    where campaign_id=v_prospect.scout_campaign_id;
    if not found
      or coalesce(v_prospect.score,0) < 60
      or v_prospect.score_version is distinct from 'ng-city-b2b-v1'
      or jsonb_typeof(v_prospect.score_factors) is distinct from 'array'
      or v_prospect.do_not_contact_at is not null
      or coalesce(v_prospect.appears_inactive_or_closed,false)
      or coalesce(v_prospect.is_consumer_only,false)
      or not exists (select 1 from unnest(v_campaign.target_categories) category
        where lower(trim(category))=lower(trim(v_prospect.business_category)))
      or lower(trim(coalesce(v_prospect.country,''))) <> lower(trim(v_campaign.country))
      or not (
        lower(trim(coalesce(v_prospect.city,'')))=lower(trim(v_campaign.city))
        or exists (select 1 from unnest(coalesce(v_prospect.service_area_cities,'{}'::text[])) city
          where lower(trim(city))=lower(trim(v_campaign.city)))
      )
      or not exists (select 1 from public.marketing_prospect_channels channel
        where channel.prospect_id=v_prospect_id and channel.is_active
          and channel.platform in ('instagram','facebook','tiktok','x','youtube','website','email','phone','whatsapp'))
    then
      raise exception using errcode='22023', message='prospect does not meet persisted qualification requirements';
    end if;
  end if;

  update public.marketing_prospects set scout_status=v_target, updated_at=now()
  where id=v_prospect_id;
  insert into public.marketing_prospect_activities(
    prospect_id,activity_type,summary,occurred_at,created_by,metadata
  ) values (
    v_prospect_id,'sales_scout','Sales Scout review status changed.',now(),p_actor_id,
    jsonb_build_object('event','scout_status_changed','previous_status',v_prospect.scout_status,
      'target_status',v_target,'reason',v_reason)
  ) returning id into v_activity_id;
  return jsonb_build_object('changed',true,'prospect_id',v_prospect_id,
    'previous_status',v_prospect.scout_status,'current_status',v_target,'activity_id',v_activity_id);
end;
$$;

revoke all on function public.transition_sales_scout_review_status(jsonb,uuid) from public;
revoke all on function public.transition_sales_scout_review_status(jsonb,uuid) from anon;
revoke all on function public.transition_sales_scout_review_status(jsonb,uuid) from authenticated;
grant execute on function public.transition_sales_scout_review_status(jsonb,uuid) to service_role;

revoke all on function public.capture_sales_scout_candidate(jsonb,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.capture_sales_scout_candidate(jsonb,text,uuid,uuid) to service_role;
revoke all on function public.update_sales_scout_qualification_facts(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.update_sales_scout_qualification_facts(jsonb,uuid) to service_role;

notify pgrst,'reload schema';
commit;
