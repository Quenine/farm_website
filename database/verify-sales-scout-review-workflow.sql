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
  v_function regprocedure;
  v_signature text;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='marketing_prospects' and column_name='scout_campaign_id') then raise exception 'scout campaign column is missing'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.marketing_prospects'::regclass and conname='marketing_prospects_scout_campaign_id_fkey' and confdeltype='r') then raise exception 'scout campaign foreign key is missing or not restrictive'; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and tablename='marketing_prospects' and indexname='marketing_prospects_scout_campaign_idx') then raise exception 'scout campaign queue index is missing'; end if;
  foreach v_signature in array array[
    'public.capture_sales_scout_candidate(jsonb,text,uuid,uuid)',
    'public.update_sales_scout_qualification_facts(jsonb,uuid)',
    'public.transition_sales_scout_review_status(jsonb,uuid)'
  ] loop
    v_function:=to_regprocedure(v_signature);
    if v_function is null then raise exception 'Sales Scout function is missing: %',v_signature; end if;
    if not exists(select 1 from pg_proc where oid=v_function and prosecdef
      and coalesce(proconfig,'{}'::text[]) @> array['search_path=public, pg_temp']) then
      raise exception 'Sales Scout function security configuration is invalid: %',v_signature;
    end if;
    if exists(select 1 from pg_proc p cross join lateral
      aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=v_function and a.grantee=0 and a.privilege_type='EXECUTE')
      or has_function_privilege('anon',v_function,'execute')
      or has_function_privilege('authenticated',v_function,'execute') then
      raise exception 'untrusted role can execute Sales Scout function: %',v_signature;
    end if;
    if not has_function_privilege('service_role',v_function,'execute') then
      raise exception 'service_role cannot execute Sales Scout function: %',v_signature;
    end if;
  end loop;

  insert into public.marketing_campaigns(id,name,slug,channel,source,medium,campaign_name,target_path)
  values(v_campaign,'Review verification','review-'||v_campaign,'instagram','manual','social','review','/admin/marketing/sales-scout');
  insert into public.marketing_sales_scout_campaigns(
    campaign_id,status,city,state,country,target_categories,daily_review_target)
  values(v_campaign,'active','Lagos','Lagos','Nigeria',array['Restaurant'],1);
  insert into public.marketing_prospects(
    id,business_name,business_category,stage,campaign_id,scout_campaign_id,scout_status,city,country,
    service_area_cities,score,score_version,score_factors,appears_inactive_or_closed,
    is_consumer_only,handover_status,handover_reason,created_by)
  values
    (v_prospect,'Eligible Review Restaurant','Restaurant','negotiating',v_campaign,v_campaign,'new',
      'Lagos','Nigeria',array['Lagos'],80,'ng-city-b2b-v1','[]'::jsonb,false,false,
      'accepted','preserve handover',v_actor),
    (v_other,'Generic Prospect','Restaurant','contacted',v_campaign,null,null,'Lagos','Nigeria',
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

do $$
declare
  v_actor uuid:=gen_random_uuid(); v_generic uuid:=gen_random_uuid(); v_scout uuid:=gen_random_uuid(); v_other_scout uuid:=gen_random_uuid();
  v_legacy uuid:=gen_random_uuid(); v_suppressed uuid:=gen_random_uuid(); v_other uuid:=gen_random_uuid(); v_result jsonb; v_payload jsonb; v_existing_activity uuid; v_count integer;
begin
  insert into public.marketing_campaigns(id,name,slug,channel,source,medium,campaign_name,target_path) values
    (v_generic,'Generic verification','generic-'||v_generic,'email','crm','owned','generic','/admin/marketing'),
    (v_scout,'Scout verification','scout-'||v_scout,'instagram','manual','social','scout','/admin/marketing/sales-scout'),
    (v_other_scout,'Other Scout verification','other-scout-'||v_other_scout,'instagram','manual','social','scout','/admin/marketing/sales-scout');
  insert into public.marketing_sales_scout_campaigns(campaign_id,status,city,state,country,target_categories,daily_review_target) values
    (v_scout,'active','Lagos','Lagos','Nigeria',array['Restaurant'],1),(v_other_scout,'active','Abuja','FCT','Nigeria',array['Restaurant'],1);
  insert into public.marketing_prospects(id,business_name,business_category,stage,campaign_id,source,created_by) values
    (v_legacy,'Legacy Restaurant','Restaurant','contacted',v_generic,'referral',v_actor),
    (v_other,'Other Restaurant','Restaurant','identified',v_generic,'referral',v_actor),
    (v_suppressed,'Suppressed Restaurant','Restaurant','contacted',v_generic,'referral',v_actor);
  update public.marketing_prospects set do_not_contact_at=now(),do_not_contact_reason='existing opt-out',do_not_contact_source='legacy',do_not_contact_by=v_actor where id=v_suppressed;
  insert into public.marketing_prospect_activities(prospect_id,activity_type,summary,occurred_at,created_by,metadata)
    values(v_legacy,'note','Existing CRM history',now(),v_actor,'{}') returning id into v_existing_activity;
  v_payload:=jsonb_build_object('campaignId',v_scout,'businessName','Legacy Restaurant','businessCategory','Restaurant','city','Lagos','state','Lagos','country','Nigeria',
    'provider','manual','providerSourceId','legacy-verification','sourceUrl','https://instagram.com/legacy_verification','observedAt',now(),
    'serviceAreaCities',jsonb_build_array('Lagos'),'demandBand','medium','isInactiveOrClosed',false,'isConsumerOnly',false,
    'score',jsonb_build_object('score',75,'ruleVersion','ng-city-b2b-v1','factors','[]'::jsonb,'scoredAt',now()),
    'channels',jsonb_build_array(jsonb_build_object('platform','instagram','handleOrValue','@legacy_verification','identityKey','legacy_verification','profileUrl','https://instagram.com/legacy_verification','isPrimary',true,'sourceId','legacy-channel','evidence',jsonb_build_object('note','public'))));
  v_result:=public.capture_sales_scout_candidate(v_payload,'attach_to_existing',v_legacy,v_actor);
  if v_result->>'prospect_id'<>v_legacy::text or not (v_result->>'existing_prospect_enrolled')::boolean then raise exception 'legacy enrollment response invalid'; end if;
  if not exists(select 1 from public.marketing_prospects where id=v_legacy and campaign_id=v_generic and scout_campaign_id=v_scout and stage='contacted' and scout_status='new' and score=75 and discovery_source='manual') then raise exception 'legacy enrollment did not preserve and populate expected facts'; end if;
  if not exists(select 1 from public.marketing_prospect_activities where id=v_existing_activity) then raise exception 'legacy activity was lost'; end if;
  if (select count(*) from public.marketing_prospect_activities where prospect_id=v_legacy and metadata->>'event'='candidate_attached')<>1 then raise exception 'legacy enrollment activity count invalid'; end if;
  v_result:=public.update_sales_scout_qualification_facts(jsonb_build_object(
    'prospectId',v_legacy,'campaignId',v_scout,'businessCategory','Restaurant',
    'city','Lagos','state','Lagos','country','Nigeria','serviceAreaCities',jsonb_build_array('Lagos'),
    'mostRecentPublicActivityAt',now(),'recurringProduceDemandEvidence','Public menu confirms recurring produce demand.',
    'demandBand','high','isInactiveOrClosed',false,'isConsumerOnly',false,
    'sourceUrl','https://instagram.com/legacy_verification',
    'locationEvidence',jsonb_build_object('source_url','https://instagram.com/legacy_verification','note','Lagos location verified'),
    'score',jsonb_build_object('score',80,'ruleVersion','ng-city-b2b-v1','factors','[]'::jsonb,'scoredAt',now())
  ),v_actor);
  if nullif(v_result->>'activity_id','') is null
    or not exists(select 1 from public.marketing_prospect_activities where id=(v_result->>'activity_id')::uuid and prospect_id=v_legacy and metadata->>'event'='scout_scored')
    or not exists(select 1 from public.marketing_prospects where id=v_legacy and campaign_id=v_generic and scout_campaign_id=v_scout and score=80)
  then raise exception 'qualification did not use the separated Scout campaign'; end if;
  v_result:=public.transition_sales_scout_review_status(jsonb_build_object('prospectId',v_legacy,'targetStatus','qualified'),v_actor);
  if v_result->>'current_status'<>'qualified'
    or not exists(select 1 from public.marketing_prospects where id=v_legacy and campaign_id=v_generic and scout_campaign_id=v_scout)
  then raise exception 'qualification transition did not preserve generic campaign separation'; end if;
  v_payload:=jsonb_set(v_payload,'{channels}',(v_payload->'channels')||jsonb_build_array(jsonb_build_object('platform','facebook','handleOrValue','legacy.restaurant','identityKey','legacy.restaurant','profileUrl','https://facebook.com/legacy.restaurant','isPrimary',false,'sourceId','legacy-facebook','evidence','{}'::jsonb)));
  begin
    perform public.capture_sales_scout_candidate(v_payload,'attach_to_existing',v_other,v_actor);
    raise exception 'exact owner mismatch succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'selected attachment target does not own the exact identity' then raise; end if;
  end;
  v_result:=public.capture_sales_scout_candidate(v_payload,'attach_to_existing',v_legacy,v_actor);
  if (v_result->>'channels_inserted')::integer<>1 then raise exception 'exact enrichment did not add one channel'; end if;
  select count(*) into v_count from public.marketing_prospect_activities where prospect_id=v_legacy and metadata->>'event'='candidate_attached';
  v_result:=public.capture_sales_scout_candidate(v_payload,'attach_to_existing',v_legacy,v_actor);
  if v_result->>'outcome'<>'exact_existing' or (select count(*) from public.marketing_prospect_activities where prospect_id=v_legacy and metadata->>'event'='candidate_attached')<>v_count then raise exception 'repeat enrichment was not a no-op'; end if;
  v_payload:=(v_payload||jsonb_build_object('businessName','Suppressed Restaurant','providerSourceId','suppressed-verification'))||jsonb_build_object('channels',jsonb_build_array(jsonb_build_object('platform','instagram','handleOrValue','@suppressed_verification','identityKey','suppressed_verification','profileUrl','https://instagram.com/suppressed_verification','isPrimary',true,'sourceId','suppressed-channel','evidence','{}'::jsonb)));
  v_result:=public.capture_sales_scout_candidate(v_payload,'attach_to_existing',v_suppressed,v_actor);
  if not exists(select 1 from public.marketing_prospects where id=v_suppressed and campaign_id=v_generic and scout_campaign_id=v_scout and scout_status='do_not_contact' and do_not_contact_at is not null and do_not_contact_reason='existing opt-out') then raise exception 'suppressed legacy enrollment cleared suppression'; end if;
  update public.marketing_prospects set scout_campaign_id=v_other_scout,scout_status='new',city='Abuja',state='FCT',country='Nigeria' where id=v_other;
  v_payload:=(v_payload||jsonb_build_object(
    'businessName','Other Restaurant','providerSourceId','cross-campaign-new-provider-id'
  ))||jsonb_build_object('channels',jsonb_build_array(jsonb_build_object(
    'platform','instagram','handleOrValue','@cross_campaign_new_identity',
    'identityKey','cross_campaign_new_identity','profileUrl','https://instagram.com/cross_campaign_new_identity',
    'isPrimary',true,'sourceId','cross-campaign-new-channel-id','evidence','{}'::jsonb
  )));
  begin
    perform public.capture_sales_scout_candidate(v_payload,'attach_to_existing',v_other,v_actor);
    raise exception 'Scout campaign conflict succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'existing Scout prospect belongs to a different Scout campaign' then raise; end if;
  end;
end $$;
rollback;
