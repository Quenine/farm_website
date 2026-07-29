begin;

do $$
declare
  v_actor uuid := gen_random_uuid();
  v_campaign_id uuid := gen_random_uuid();
  v_existing_id uuid := gen_random_uuid();
  v_created_id uuid;
  v_result jsonb;
  v_payload jsonb;
  v_before jsonb;
  v_after jsonb;
begin
  if to_regprocedure('public.capture_sales_scout_candidate(jsonb,text,uuid,uuid)') is null then
    raise exception 'capture_sales_scout_candidate function is missing';
  end if;
  if exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(coalesce(
        procedure.proacl,
        acldefault('f', procedure.proowner)
      )) privilege
      where procedure.oid = 'public.capture_sales_scout_candidate(jsonb,text,uuid,uuid)'::regprocedure
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    )
    or has_function_privilege('anon', 'public.capture_sales_scout_candidate(jsonb,text,uuid,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.capture_sales_scout_candidate(jsonb,text,uuid,uuid)', 'EXECUTE') then
    raise exception 'candidate capture function is exposed to an untrusted role';
  end if;
  if not has_function_privilege('service_role', 'public.capture_sales_scout_candidate(jsonb,text,uuid,uuid)', 'EXECUTE') then
    raise exception 'service_role lacks candidate capture execute privilege';
  end if;

  insert into public.marketing_campaigns (
    id, name, slug, channel, source, medium, campaign_name, target_path
  ) values (
    v_campaign_id, 'Scout ingestion verification', 'scout-ingestion-' || v_campaign_id,
    'instagram', 'manual', 'social', 'scout_ingestion_verify', '/admin/marketing/sales-scout'
  );
  insert into public.marketing_sales_scout_campaigns (
    campaign_id, status, city, state, country, target_categories, daily_review_target
  ) values (
    v_campaign_id, 'active', 'Lagos', 'Lagos', 'Nigeria',
    array['Restaurant','Caterer','Hotel','Supermarket','Food Vendor'], 1
  );

  v_payload := jsonb_build_object(
    'provider', 'manual',
    'providerSourceId', 'verify-provider-1',
    'sourceUrl', 'https://www.instagram.com/scout_verify_one/',
    'observedAt', '2026-07-29T12:00:00+01:00',
    'campaignId', v_campaign_id,
    'businessName', 'Scout Verify Restaurant',
    'businessCategory', 'Restaurant',
    'city', 'Lagos',
    'state', 'Lagos',
    'country', 'Nigeria',
    'serviceAreaCities', jsonb_build_array('Lagos'),
    'demandBand', 'medium',
    'isInactiveOrClosed', false,
    'isConsumerOnly', false,
    'channels', jsonb_build_array(jsonb_build_object(
      'platform', 'instagram',
      'handleOrValue', '@scout_verify_one',
      'identityKey', 'scout_verify_one',
      'profileUrl', 'https://www.instagram.com/scout_verify_one/',
      'isPrimary', true,
      'sourceId', 'verify-channel-1',
      'evidence', '{}'::jsonb
    )),
    'score', jsonb_build_object(
      'score', 60,
      'ruleVersion', 'sales-scout-v1',
      'factors', '{}'::jsonb,
      'scoredAt', '2026-07-29T12:00:00+01:00'
    )
  );

  begin
    perform public.capture_sales_scout_candidate(v_payload, 'create_new', null, null);
    raise exception 'null actor capture unexpectedly succeeded';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'actor id is required for candidate capture' then
        raise exception 'unexpected null actor error: %', sqlerrm;
      end if;
  end;

  v_result := public.capture_sales_scout_candidate(v_payload, 'create_new', null, v_actor);
  if v_result->>'outcome' <> 'created' or (v_result->>'channels_inserted')::integer <> 1 then
    raise exception 'new candidate was not captured as expected: %', v_result;
  end if;
  v_created_id := (v_result->>'prospect_id')::uuid;
  if not exists (
    select 1 from public.marketing_prospects
    where id = v_created_id and scout_status = 'new' and stage = 'identified'
      and score = 60 and do_not_contact_at is null
  ) then
    raise exception 'created prospect fields are incorrect';
  end if;
  if not exists (
    select 1 from public.marketing_prospect_channels
    where prospect_id = v_created_id and platform = 'instagram'
      and identity_key = 'scout_verify_one' and is_primary
  ) then
    raise exception 'created prospect channel is incorrect';
  end if;

  v_result := public.capture_sales_scout_candidate(v_payload, 'create_new', null, v_actor);
  if v_result->>'outcome' <> 'exact_existing'
    or (v_result->>'prospect_id')::uuid <> v_created_id
    or (v_result->>'channels_inserted')::integer <> 0 then
    raise exception 'exact identity was not returned unchanged: %', v_result;
  end if;

  insert into public.marketing_prospects (
    id, business_name, stage, scout_status, do_not_contact_at,
    do_not_contact_reason, score, created_by
  ) values (
    v_existing_id, 'Existing Scout Prospect', 'negotiating', 'do_not_contact', now(),
    'verification suppression', 91, v_actor
  );
  select to_jsonb(p) into v_before
  from public.marketing_prospects p where id = v_existing_id;

  v_payload := jsonb_set(
    jsonb_set(
      jsonb_set(v_payload, '{providerSourceId}', '"verify-provider-2"'),
      '{channels,0,handleOrValue}', '"@scout_verify_two"'
    ),
    '{channels,0,identityKey}', '"scout_verify_two"'
  );
  v_payload := jsonb_set(v_payload, '{channels,0,sourceId}', '"verify-channel-2"');
  v_result := public.capture_sales_scout_candidate(
    v_payload, 'attach_to_existing', v_existing_id, v_actor
  );
  if v_result->>'outcome' <> 'attached' or (v_result->>'prospect_id')::uuid <> v_existing_id then
    raise exception 'candidate was not attached as expected: %', v_result;
  end if;
  select to_jsonb(p) into v_after
  from public.marketing_prospects p where id = v_existing_id;
  if v_after is distinct from v_before then
    raise exception 'attachment changed existing prospect qualification or suppression state';
  end if;
  if not exists (
    select 1 from public.marketing_prospect_channels
    where prospect_id = v_existing_id and identity_key = 'scout_verify_two'
  ) then
    raise exception 'attachment did not add the new channel';
  end if;
  if exists (
    select 1 from public.marketing_prospect_outreaches
    where prospect_id in (v_created_id, v_existing_id)
  ) then
    raise exception 'candidate capture created outreach';
  end if;
end $$;

rollback;
