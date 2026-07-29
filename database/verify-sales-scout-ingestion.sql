begin;

do $$
declare
  v_actor uuid := gen_random_uuid();
  v_campaign_id uuid := gen_random_uuid();
  v_other_campaign_id uuid := gen_random_uuid();
  v_generic_campaign_id uuid := gen_random_uuid();
  v_created_id uuid;
  v_existing_id uuid := gen_random_uuid();
  v_non_scout_id uuid := gen_random_uuid();
  v_owner_one uuid := gen_random_uuid();
  v_owner_two uuid := gen_random_uuid();
  v_result jsonb;
  v_payload jsonb;
  v_qualification jsonb;
  v_before jsonb;
  v_after jsonb;
  v_count integer;
  v_function regprocedure;
begin
  foreach v_function in array array[
    to_regprocedure('public.capture_sales_scout_candidate(jsonb,text,uuid,uuid)'),
    to_regprocedure('public.update_sales_scout_qualification_facts(jsonb,uuid)')
  ]
  loop
    if v_function is null then
      raise exception 'required Sales Scout ingestion function is missing';
    end if;
    if not exists (
      select 1 from pg_proc
      where oid = v_function
        and prosecdef
        and coalesce(proconfig, '{}'::text[]) @> array['search_path=public, pg_temp']
    ) then
      raise exception 'function lacks SECURITY DEFINER or fixed search path: %', v_function;
    end if;
    if exists (
      select 1
      from pg_proc procedure
      cross join lateral aclexplode(coalesce(
        procedure.proacl,
        acldefault('f', procedure.proowner)
      )) privilege
      where procedure.oid = v_function
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ) or has_function_privilege('anon', v_function, 'EXECUTE')
      or has_function_privilege('authenticated', v_function, 'EXECUTE') then
      raise exception 'untrusted role can execute: %', v_function;
    end if;
    if not has_function_privilege('service_role', v_function, 'EXECUTE') then
      raise exception 'service_role cannot execute: %', v_function;
    end if;
  end loop;

  insert into public.marketing_campaigns (
    id, name, slug, channel, source, medium, campaign_name, target_path
  ) values
    (v_campaign_id, 'Scout ingestion verification', 'scout-ingestion-' || v_campaign_id,
      'instagram', 'manual', 'social', 'scout_ingestion_verify', '/admin/marketing/sales-scout'),
    (v_other_campaign_id, 'Other Scout verification', 'scout-other-' || v_other_campaign_id,
      'instagram', 'manual', 'social', 'scout_other_verify', '/admin/marketing/sales-scout'),
    (v_generic_campaign_id, 'Generic marketing verification', 'generic-' || v_generic_campaign_id,
      'instagram', 'manual', 'social', 'generic_verify', '/admin/marketing');
  insert into public.marketing_sales_scout_campaigns (
    campaign_id, status, city, state, country, target_categories, daily_review_target
  ) values
    (v_campaign_id, 'active', 'Lagos', 'Lagos', 'Nigeria',
      array['Restaurant','Caterer','Hotel','Supermarket','Food Vendor'], 1),
    (v_other_campaign_id, 'active', 'Abuja', 'FCT', 'Nigeria',
      array['Restaurant'], 1);

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
    'mostRecentPublicActivityAt', '2026-07-20T12:00:00+01:00',
    'recurringProduceDemandEvidence', 'Public menu shows recurring produce demand.',
    'demandBand', 'medium',
    'isInactiveOrClosed', false,
    'isConsumerOnly', false,
    'channels', jsonb_build_array(
      jsonb_build_object(
        'platform', 'instagram', 'handleOrValue', '@scout_verify_one',
        'identityKey', 'scout_verify_one',
        'profileUrl', 'https://www.instagram.com/scout_verify_one/',
        'isPrimary', true, 'sourceId', 'verify-channel-1',
        'evidence', jsonb_build_object('source', 'public profile')
      ),
      jsonb_build_object(
        'platform', 'website', 'handleOrValue', 'https://scout-verify.example/',
        'identityKey', 'scout-verify.example',
        'profileUrl', 'https://scout-verify.example/',
        'isPrimary', false, 'sourceId', 'verify-channel-2',
        'evidence', jsonb_build_object('source', 'public website')
      )
    ),
    'score', jsonb_build_object(
      'score', 75,
      'ruleVersion', 'ng-city-b2b-v1',
      'factors', jsonb_build_array(
        jsonb_build_object(
          'key', 'allowed_category', 'points', 20, 'applied', true,
          'reason', 'Category is allowed by the campaign.'
        ),
        jsonb_build_object(
          'key', 'campaign_city_presence', 'points', 20, 'applied', true,
          'reason', 'Business presence in the campaign city is verified.'
        )
      ),
      'scoredAt', '2026-07-29T12:00:00+01:00'
    )
  );

  begin
    perform public.capture_sales_scout_candidate(v_payload, 'create_new', null, null);
    raise exception 'null actor capture unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'actor id is required for candidate capture' then
      raise exception 'unexpected null actor error: %', sqlerrm;
    end if;
  end;
  begin
    perform public.capture_sales_scout_candidate(
      jsonb_set(v_payload, '{score,ruleVersion}', '"wrong-version"'),
      'create_new', null, v_actor
    );
    raise exception 'invalid capture score version unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'candidate score payload is invalid' then raise; end if;
  end;
  begin
    perform public.capture_sales_scout_candidate(
      jsonb_set(v_payload, '{score,factors}', '{}'::jsonb),
      'create_new', null, v_actor
    );
    raise exception 'non-array capture factors unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'candidate score payload is invalid' then raise; end if;
  end;
  begin
    perform public.capture_sales_scout_candidate(
      jsonb_set(v_payload, '{campaignId}', to_jsonb(v_generic_campaign_id::text)),
      'create_new', null, v_actor
    );
    raise exception 'generic campaign capture unexpectedly succeeded';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'Sales Scout campaign not found' then raise; end if;
  end;

  v_result := public.capture_sales_scout_candidate(v_payload, 'create_new', null, v_actor);
  if v_result->>'outcome' <> 'created' or (v_result->>'channels_inserted')::integer <> 2 then
    raise exception 'new candidate was not captured with both channels: %', v_result;
  end if;
  v_created_id := (v_result->>'prospect_id')::uuid;
  if (select count(*) from public.marketing_prospects where id = v_created_id
      and scout_status = 'new' and stage = 'identified' and score = 75
      and score_version = 'ng-city-b2b-v1' and jsonb_typeof(score_factors) = 'array') <> 1 then
    raise exception 'created prospect score fields are incorrect';
  end if;
  if (select count(*) from public.marketing_prospect_channels
      where prospect_id = v_created_id) <> 2
    or (select count(*) from public.marketing_prospect_channels
      where prospect_id = v_created_id and is_active and is_primary) <> 1 then
    raise exception 'created candidate channel count or primary channel is incorrect';
  end if;
  if (select count(*) from public.marketing_prospect_activities
      where prospect_id = v_created_id and metadata->>'event' = 'scout_captured') <> 1 then
    raise exception 'scout_captured activity is missing or duplicated';
  end if;

  select count(*) into v_count from public.marketing_prospect_activities
  where prospect_id = v_created_id;
  v_result := public.capture_sales_scout_candidate(v_payload, 'create_new', null, v_actor);
  if v_result->>'outcome' <> 'exact_existing'
    or (v_result->>'prospect_id')::uuid <> v_created_id
    or (v_result->>'channels_inserted')::integer <> 0
    or (select count(*) from public.marketing_prospects
      where discovery_source = 'manual' and discovery_source_id = 'verify-provider-1') <> 1
    or (select count(*) from public.marketing_prospect_channels
      where prospect_id = v_created_id) <> 2
    or (select count(*) from public.marketing_prospect_activities
      where prospect_id = v_created_id) <> v_count then
    raise exception 'repeated candidate changed persisted state: %', v_result;
  end if;

  insert into public.marketing_prospects (
    id, business_name, stage, campaign_id, scout_status, score, score_version,
    score_factors, do_not_contact_at, do_not_contact_reason, do_not_contact_source,
    handover_status, handover_reason, created_by
  ) values
    (v_owner_one, 'Identity owner one', 'identified', v_campaign_id, 'new', 31,
      'ng-city-b2b-v1', '[]'::jsonb, null, null, null, 'not_ready', null, v_actor),
    (v_owner_two, 'Identity owner two', 'identified', v_campaign_id, 'new', 32,
      'ng-city-b2b-v1', '[]'::jsonb, null, null, null, 'not_ready', null, v_actor),
    (v_existing_id, 'Existing Scout Prospect', 'negotiating', v_campaign_id,
      'do_not_contact', 91, 'ng-city-b2b-v1', '[]'::jsonb, now(),
      'verification suppression', 'owner_request', 'accepted', 'verified handover', v_actor),
    (v_non_scout_id, 'Generic prospect', 'contacted', v_generic_campaign_id,
      null, null, null, null, null, null, null, null, null, v_actor);
  insert into public.marketing_prospect_channels (
    prospect_id, platform, handle_or_value, identity_key, is_primary, source, source_id, created_by
  ) values
    (v_owner_one, 'instagram', '@identity_owner_one', 'identity_owner_one', true,
      'manual', 'owner-channel-1', v_actor),
    (v_owner_two, 'website', 'https://identity-two.example/', 'identity-two.example', true,
      'manual', 'owner-channel-2', v_actor);

  v_payload := jsonb_set(v_payload, '{providerSourceId}', '"multi-provider"');
  v_payload := jsonb_set(v_payload, '{channels}', jsonb_build_array(
    jsonb_build_object(
      'platform', 'instagram', 'handleOrValue', '@identity_owner_one',
      'identityKey', 'identity_owner_one', 'isPrimary', true,
      'sourceId', 'multi-channel-1', 'evidence', '{}'::jsonb
    ),
    jsonb_build_object(
      'platform', 'website', 'handleOrValue', 'https://identity-two.example/',
      'identityKey', 'identity-two.example', 'isPrimary', false,
      'sourceId', 'multi-channel-2', 'evidence', '{}'::jsonb
    )
  ));
  begin
    perform public.capture_sales_scout_candidate(v_payload, 'create_new', null, v_actor);
    raise exception 'multi-prospect candidate unexpectedly succeeded';
  exception when sqlstate '23000' then
    if sqlerrm <> 'candidate identities match multiple prospects' then
      raise exception 'multi-prospect conflict was rewritten: %', sqlerrm;
    end if;
  end;

  v_payload := jsonb_set(v_payload, '{channels}', jsonb_build_array(
    jsonb_build_object(
      'platform', 'instagram', 'handleOrValue', '@identity_owner_one',
      'identityKey', 'identity_owner_one', 'isPrimary', true,
      'sourceId', 'owner-channel-1', 'evidence', '{}'::jsonb
    )
  ));
  v_result := public.capture_sales_scout_candidate(
    v_payload, 'attach_to_existing', v_existing_id, v_actor
  );
  if v_result->>'outcome' <> 'exact_existing'
    or (v_result->>'prospect_id')::uuid <> v_owner_one
    or exists (select 1 from public.marketing_prospect_channels
      where prospect_id = v_existing_id and identity_key = 'identity_owner_one') then
    raise exception 'attachment moved an identity owned by another prospect: %', v_result;
  end if;

  select to_jsonb(p) into v_before from public.marketing_prospects p where id = v_existing_id;
  v_payload := jsonb_set(v_payload, '{providerSourceId}', '"attach-provider"');
  v_payload := jsonb_set(v_payload, '{channels}', jsonb_build_array(
    jsonb_build_object(
      'platform', 'facebook', 'handleOrValue', '@new_attachment',
      'identityKey', 'new_attachment', 'isPrimary', true,
      'sourceId', 'attach-channel-1', 'evidence', '{}'::jsonb
    )
  ));
  v_result := public.capture_sales_scout_candidate(
    v_payload, 'attach_to_existing', v_existing_id, v_actor
  );
  if v_result->>'outcome' <> 'attached'
    or (v_result->>'channels_inserted')::integer <> 1
    or (select count(*) from public.marketing_prospect_channels
      where prospect_id = v_existing_id and identity_key = 'new_attachment') <> 1
    or (select count(*) from public.marketing_prospect_activities
      where prospect_id = v_existing_id and metadata->>'event' = 'candidate_attached') <> 1 then
    raise exception 'new attachment channel or activity is incorrect: %', v_result;
  end if;
  select to_jsonb(p) into v_after from public.marketing_prospects p where id = v_existing_id;
  if v_after is distinct from v_before then
    raise exception 'attachment changed stage, suppression, handover, or score state';
  end if;
  if exists (
    select 1 from public.marketing_prospect_outreaches
    where prospect_id in (v_created_id, v_existing_id)
  ) or exists (
    select 1 from public.marketing_prospect_attributions
    where prospect_id in (v_created_id, v_existing_id)
  ) then
    raise exception 'candidate capture created outreach or attribution';
  end if;

  v_qualification := jsonb_build_object(
    'prospectId', v_existing_id,
    'campaignId', v_campaign_id,
    'businessCategory', 'Hotel',
    'city', 'Lagos',
    'state', 'Lagos',
    'country', 'Nigeria',
    'serviceAreaCities', jsonb_build_array('Lagos', 'Ikeja'),
    'mostRecentPublicActivityAt', '2026-07-28T12:00:00+01:00',
    'recurringProduceDemandEvidence', 'Banqueting menu and public procurement post.',
    'demandBand', 'high',
    'isInactiveOrClosed', false,
    'isConsumerOnly', false,
    'sourceUrl', 'https://example.com/qualification-evidence',
    'locationEvidence', jsonb_build_object('source', 'public address'),
    'score', jsonb_build_object(
      'score', 88,
      'ruleVersion', 'ng-city-b2b-v1',
      'factors', jsonb_build_array(jsonb_build_object(
        'key', 'allowed_category', 'points', 20, 'applied', true,
        'reason', 'Category is allowed by the campaign.'
      )),
      'scoredAt', '2026-07-29T13:00:00+01:00'
    )
  );
  begin
    perform public.update_sales_scout_qualification_facts(v_qualification, null);
    raise exception 'null actor qualification unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'actor id is required for qualification update' then raise; end if;
  end;
  begin
    perform public.update_sales_scout_qualification_facts(
      jsonb_set(v_qualification, '{prospectId}', to_jsonb(v_non_scout_id::text)), v_actor
    );
    raise exception 'non-Scout qualification unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'prospect is not a Sales Scout prospect' then raise; end if;
  end;
  begin
    perform public.update_sales_scout_qualification_facts(
      jsonb_set(v_qualification, '{campaignId}', to_jsonb(v_other_campaign_id::text)), v_actor
    );
    raise exception 'campaign mismatch qualification unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'prospect campaign does not match qualification campaign' then raise; end if;
  end;
  begin
    perform public.update_sales_scout_qualification_facts(
      jsonb_set(v_qualification, '{score,ruleVersion}', '"wrong-version"'), v_actor
    );
    raise exception 'invalid qualification score version unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'qualification score payload is invalid' then raise; end if;
  end;
  begin
    perform public.update_sales_scout_qualification_facts(
      jsonb_set(v_qualification, '{score,factors}', '{}'::jsonb), v_actor
    );
    raise exception 'non-array qualification factors unexpectedly succeeded';
  exception when sqlstate '22023' then
    if sqlerrm <> 'qualification score payload is invalid' then raise; end if;
  end;

  select jsonb_build_object(
    'stage', stage, 'scout_status', scout_status,
    'do_not_contact_at', do_not_contact_at, 'do_not_contact_reason', do_not_contact_reason,
    'do_not_contact_source', do_not_contact_source,
    'handover_status', handover_status, 'handover_reason', handover_reason
  ) into v_before from public.marketing_prospects where id = v_existing_id;
  select count(*) into v_count from public.marketing_prospect_activities
  where prospect_id = v_existing_id and metadata->>'event' = 'scout_scored';
  v_result := public.update_sales_scout_qualification_facts(v_qualification, v_actor);
  if (v_result->>'prospect_id')::uuid <> v_existing_id
    or (v_result->>'score')::integer <> 88
    or v_result->>'rule_version' <> 'ng-city-b2b-v1'
    or nullif(v_result->>'activity_id', '') is null then
    raise exception 'qualification result is incorrect: %', v_result;
  end if;
  select jsonb_build_object(
    'stage', stage, 'scout_status', scout_status,
    'do_not_contact_at', do_not_contact_at, 'do_not_contact_reason', do_not_contact_reason,
    'do_not_contact_source', do_not_contact_source,
    'handover_status', handover_status, 'handover_reason', handover_reason
  ) into v_after from public.marketing_prospects where id = v_existing_id;
  if v_after is distinct from v_before then
    raise exception 'qualification changed protected prospect state';
  end if;
  if not exists (
    select 1 from public.marketing_prospects
    where id = v_existing_id and business_category = 'Hotel'
      and city = 'Lagos' and state = 'Lagos' and country = 'Nigeria'
      and service_area_cities = array['Lagos','Ikeja']
      and has_recurring_produce_demand and demand_band = 'high'
      and not appears_inactive_or_closed and not is_consumer_only
      and score = 88 and score_version = 'ng-city-b2b-v1'
      and jsonb_typeof(score_factors) = 'array'
  ) then
    raise exception 'qualification facts or score were not updated';
  end if;
  if (select count(*) from public.marketing_prospect_activities
      where prospect_id = v_existing_id and metadata->>'event' = 'scout_scored') <> v_count + 1
    or not exists (
      select 1 from public.marketing_prospect_activities
      where id = (v_result->>'activity_id')::uuid
        and prospect_id = v_existing_id and metadata->>'event' = 'scout_scored'
    ) then
    raise exception 'scout_scored activity is missing, duplicated, or mismatched';
  end if;
end $$;

rollback;
