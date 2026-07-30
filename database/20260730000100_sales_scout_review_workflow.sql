begin;

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
    where campaign_id=v_prospect.campaign_id;
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

notify pgrst,'reload schema';
commit;
