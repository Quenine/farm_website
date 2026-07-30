begin;

do $$
declare
  v_actor uuid:=gen_random_uuid();
  v_campaign uuid:=gen_random_uuid();
  v_prospect uuid:=gen_random_uuid();
  v_other uuid:=gen_random_uuid();
  v_result jsonb;
  v_before jsonb;
  v_count integer;
  v_function regprocedure:=to_regprocedure('public.transition_sales_scout_review_status(jsonb,uuid)');
begin
  if v_function is null then raise exception 'review transition function is missing'; end if;
  if not exists(select 1 from pg_proc where oid=v_function and prosecdef
    and coalesce(proconfig,'{}'::text[]) @> array['search_path=public, pg_temp']) then
    raise exception 'review transition security configuration is invalid';
  end if;
  if exists(select 1 from pg_proc p cross join lateral
    aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.oid=v_function and a.grantee=0 and a.privilege_type='EXECUTE')
    or has_function_privilege('anon',v_function,'execute')
    or has_function_privilege('authenticated',v_function,'execute') then
    raise exception 'untrusted role can execute review transition';
  end if;
  if not has_function_privilege('service_role',v_function,'execute') then
    raise exception 'service_role cannot execute review transition';
  end if;

  insert into public.marketing_campaigns(id,name,slug,channel,source,medium,campaign_name,target_path)
  values(v_campaign,'Review verification','review-'||v_campaign,'instagram','manual','social','review','/admin/marketing/sales-scout');
  insert into public.marketing_sales_scout_campaigns(
    campaign_id,status,city,state,country,target_categories,daily_review_target)
  values(v_campaign,'active','Lagos','Lagos','Nigeria',array['Restaurant'],1);
  insert into public.marketing_prospects(
    id,business_name,business_category,stage,campaign_id,scout_status,city,country,
    service_area_cities,score,score_version,score_factors,appears_inactive_or_closed,
    is_consumer_only,handover_status,handover_reason,created_by)
  values
    (v_prospect,'Eligible Review Restaurant','Restaurant','negotiating',v_campaign,'new',
      'Lagos','Nigeria',array['Lagos'],80,'ng-city-b2b-v1','[]'::jsonb,false,false,
      'accepted','preserve handover',v_actor),
    (v_other,'Generic Prospect','Restaurant','contacted',v_campaign,null,'Lagos','Nigeria',
      array['Lagos'],80,'ng-city-b2b-v1','[]'::jsonb,false,false,null,null,v_actor);
  insert into public.marketing_prospect_channels(
    prospect_id,platform,handle_or_value,identity_key,is_primary,created_by)
  values(v_prospect,'instagram','@review_verify','review_verify',true,v_actor);

  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','researching'),null);
    raise exception 'null actor unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',gen_random_uuid(),'targetStatus','researching'),v_actor);
    raise exception 'unknown prospect unexpectedly succeeded';
  exception when sqlstate 'P0002' then null; end;
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_other,'targetStatus','researching'),v_actor);
    raise exception 'non-Scout prospect unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','engaged'),v_actor);
    raise exception 'invalid status unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','disqualified'),v_actor);
    raise exception 'missing reason unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;

  select jsonb_build_object('stage',stage,'campaign_id',campaign_id,
    'do_not_contact_at',do_not_contact_at,'handover_status',handover_status,
    'handover_reason',handover_reason) into v_before
  from public.marketing_prospects where id=v_prospect;
  v_result:=public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','researching'),v_actor);
  if not (v_result->>'changed')::boolean then raise exception 'research transition failed'; end if;
  select count(*) into v_count from public.marketing_prospect_activities
    where prospect_id=v_prospect and metadata->>'event'='scout_status_changed';
  v_result:=public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','researching'),v_actor);
  if (v_result->>'changed')::boolean or (select count(*) from public.marketing_prospect_activities
    where prospect_id=v_prospect and metadata->>'event'='scout_status_changed')<>v_count then
    raise exception 'idempotent transition created activity';
  end if;

  update public.marketing_prospects set score=59 where id=v_prospect;
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','qualified'),v_actor);
    raise exception 'under-threshold qualification succeeded';
  exception when sqlstate '22023' then null; end;
  update public.marketing_prospects set score=80,appears_inactive_or_closed=true where id=v_prospect;
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','qualified'),v_actor);
    raise exception 'inactive qualification succeeded';
  exception when sqlstate '22023' then null; end;
  update public.marketing_prospects set appears_inactive_or_closed=false,is_consumer_only=true where id=v_prospect;
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','qualified'),v_actor);
    raise exception 'consumer qualification succeeded';
  exception when sqlstate '22023' then null; end;
  update public.marketing_prospects set is_consumer_only=false,business_category='Bank' where id=v_prospect;
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','qualified'),v_actor);
    raise exception 'wrong-category qualification succeeded';
  exception when sqlstate '22023' then null; end;
  update public.marketing_prospects set business_category='Restaurant',city='Ibadan',
    service_area_cities=array['Ibadan'] where id=v_prospect;
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','qualified'),v_actor);
    raise exception 'outside-geography qualification succeeded';
  exception when sqlstate '22023' then null; end;
  update public.marketing_prospects set city='Lagos',service_area_cities=array['Lagos'] where id=v_prospect;
  update public.marketing_prospect_channels set is_active=false where prospect_id=v_prospect;
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','qualified'),v_actor);
    raise exception 'channel-less qualification succeeded';
  exception when sqlstate '22023' then null; end;
  update public.marketing_prospect_channels set is_active=true where prospect_id=v_prospect;
  v_result:=public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','qualified'),v_actor);
  if v_result->>'current_status'<>'qualified' or nullif(v_result->>'activity_id','') is null then
    raise exception 'eligible qualification failed';
  end if;
  v_result:=public.transition_sales_scout_review_status(jsonb_build_object(
    'prospectId',v_prospect,'targetStatus','disqualified','reason','Not current fit'),v_actor);
  if v_result->>'current_status'<>'disqualified' then raise exception 'disqualification failed'; end if;
  if (select jsonb_build_object('stage',stage,'campaign_id',campaign_id,
      'do_not_contact_at',do_not_contact_at,'handover_status',handover_status,
      'handover_reason',handover_reason) from public.marketing_prospects where id=v_prospect)
      is distinct from v_before then raise exception 'protected state changed'; end if;

  perform public.set_sales_scout_do_not_contact(v_prospect,'owner request','owner_request',v_actor);
  begin perform public.transition_sales_scout_review_status(
    jsonb_build_object('prospectId',v_prospect,'targetStatus','new'),v_actor);
    raise exception 'suppressed prospect left do-not-contact';
  exception when sqlstate '22023' then null; end;
end $$;

rollback;
