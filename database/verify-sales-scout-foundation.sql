-- Sales Scout Batch 2 verification.
-- Run only after the foundation migration in a non-production Supabase project.
-- All fixtures are rolled back.

begin;

do $$
declare
  v_missing text;
  v_table text;
  v_role text;
  v_privilege text;
  v_function regprocedure;
  v_legacy uuid;
  v_prospect uuid;
  v_other_prospect uuid;
  v_channel uuid;
  v_other_channel uuid;
  v_other_prospect_channel uuid;
  v_outreach uuid;
  v_pending uuid;
  v_order_one uuid;
  v_order_two uuid;
  v_type text;
  v_actor uuid:=gen_random_uuid();
begin
  select string_agg(required.column_name,', ' order by required.column_name)
  into v_missing
  from (values
    ('scout_status'),('city'),('state'),('country'),('location_evidence'),
    ('service_area_cities'),('discovery_source'),('discovery_source_id'),
    ('source_url'),('discovered_at'),('website_host'),
    ('contact_email_normalized'),('contact_phone_normalized'),
    ('profile_last_activity_at'),('has_recurring_produce_demand'),
    ('recurring_demand_evidence'),('demand_band'),
    ('appears_inactive_or_closed'),('is_consumer_only'),('score'),
    ('score_version'),('score_factors'),('scored_at'),('do_not_contact_at'),
    ('do_not_contact_reason'),('do_not_contact_source'),('do_not_contact_by'),
    ('handover_status'),('handover_ready_at'),('handover_accepted_at'),
    ('handover_completed_at'),('handover_reason'),('created_by')
  ) required(column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name='marketing_prospects'
      and c.column_name=required.column_name
  );
  if v_missing is not null then raise exception 'missing prospect columns: %',v_missing; end if;

  foreach v_table in array array[
    'marketing_sales_scout_campaigns','marketing_prospect_channels',
    'marketing_prospect_outreaches','marketing_prospect_attributions'
  ] loop
    if to_regclass('public.'||v_table) is null then
      raise exception 'missing table: %',v_table;
    end if;
    if not coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.'||v_table)),false) then
      raise exception 'RLS is not enabled: %',v_table;
    end if;
    if exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=v_table
    ) then
      raise exception 'unexpected policy exists: %',v_table;
    end if;
    foreach v_privilege in array array['select','insert','update','delete'] loop
      if exists (
        select 1
        from pg_class c
        cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
        where c.oid=to_regclass('public.'||v_table)
          and acl.grantee=0
          and acl.privilege_type=upper(v_privilege)
      ) then
        raise exception 'PUBLIC has unexpected % privilege on %',v_privilege,v_table;
      end if;
      foreach v_role in array array['anon','authenticated'] loop
        if has_table_privilege(v_role,'public.'||v_table,v_privilege) then
          raise exception '% has unexpected % privilege on %',v_role,v_privilege,v_table;
        end if;
      end loop;
      if not has_table_privilege('service_role','public.'||v_table,v_privilege) then
        raise exception 'service_role lacks % privilege on %',v_privilege,v_table;
      end if;
    end loop;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='marketing_prospect_activities'
      and column_name='metadata' and is_nullable='NO'
  ) then raise exception 'activity metadata column missing or nullable'; end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.marketing_prospect_outreaches'::regclass
      and conname='marketing_prospect_outreaches_sequence_kind_check'
  ) then raise exception 'sequence/kind constraint missing'; end if;
  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and indexname='marketing_prospect_channels_active_identity_uidx'
  ) then raise exception 'active channel identity index missing'; end if;
  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and indexname='marketing_prospect_channels_active_primary_uidx'
  ) then raise exception 'active primary channel index missing'; end if;
  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and indexname='marketing_prospect_outreaches_due_idx'
  ) then raise exception 'outreach due index missing'; end if;

  foreach v_function in array array[
    'public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid)'::regprocedure,
    'public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid,jsonb)'::regprocedure,
    'public.set_sales_scout_do_not_contact(uuid,text,text,uuid)'::regprocedure,
    'public.confirm_sales_scout_outreach_sent(uuid,text,text,timestamptz,uuid,text)'::regprocedure
  ] loop
    if not (select prosecdef from pg_proc where oid=v_function) then
      raise exception 'function is not security definer: %',v_function;
    end if;
    if coalesce((select array_to_string(proconfig,',') from pg_proc where oid=v_function),'')
       not like '%search_path=public, pg_temp%'
       and coalesce((select array_to_string(proconfig,',') from pg_proc where oid=v_function),'')
       not like '%search_path=public,pg_temp%' then
      raise exception 'function lacks safe search path: %',v_function;
    end if;
    if exists (
         select 1
         from pg_proc p
         cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
         where p.oid=v_function and acl.grantee=0 and acl.privilege_type='EXECUTE'
       )
       or has_function_privilege('anon',v_function,'execute')
       or has_function_privilege('authenticated',v_function,'execute') then
      raise exception 'untrusted role can execute: %',v_function;
    end if;
    if not has_function_privilege('service_role',v_function,'execute') then
      raise exception 'service_role cannot execute: %',v_function;
    end if;
  end loop;

  if (select count(*) from public.marketing_campaigns
      where slug='sales-scout-lagos-food-businesses-launch')<>1
     or (select count(*) from public.marketing_sales_scout_campaigns s
         join public.marketing_campaigns c on c.id=s.campaign_id
         where c.slug='sales-scout-lagos-food-businesses-launch')<>1 then
    raise exception 'Lagos draft campaign is not exactly once';
  end if;

  insert into public.marketing_prospects(business_name,stage,source)
  values ('__sales_scout_verify_legacy','identified','verification')
  returning id into v_legacy;
  if (select scout_status is not null from public.marketing_prospects where id=v_legacy) then
    raise exception 'legacy prospect was marked as a Scout prospect';
  end if;

  insert into public.marketing_prospects(business_name,stage,source,scout_status,city,country)
  values ('__sales_scout_verify_primary','identified','verification','qualified','Lagos','Nigeria')
  returning id into v_prospect;
  insert into public.marketing_prospects(business_name,stage,source,scout_status,city,country)
  values ('__sales_scout_verify_other','identified','verification','qualified','Lagos','Nigeria')
  returning id into v_other_prospect;

  insert into public.marketing_prospect_channels
    (prospect_id,platform,handle_or_value,identity_key,is_primary,source,source_id)
  values (v_prospect,'instagram','@verify_primary','verify_primary',true,'verification','primary')
  returning id into v_channel;
  insert into public.marketing_prospect_channels
    (prospect_id,platform,handle_or_value,identity_key,is_primary,source,source_id)
  values (v_prospect,'email','verify@example.invalid','verify@example.invalid',false,'verification','email')
  returning id into v_other_channel;
  insert into public.marketing_prospect_channels
    (prospect_id,platform,handle_or_value,identity_key,is_primary,source,source_id)
  values (v_other_prospect,'email','other@example.invalid','other@example.invalid',true,'verification','other-email')
  returning id into v_other_prospect_channel;

  begin
    insert into public.marketing_prospect_channels
      (prospect_id,platform,handle_or_value,identity_key)
    values (v_other_prospect,'instagram','@verify_primary','verify_primary');
    raise exception 'active channel duplicate was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.marketing_prospect_channels
      (prospect_id,platform,handle_or_value,identity_key,is_primary)
    values (v_prospect,'phone','07000000000','+2347000000000',true);
    raise exception 'second active primary channel was accepted';
  exception when unique_violation then null;
  end;

  insert into public.marketing_prospect_outreaches
    (prospect_id,channel_id,sequence_number,kind,status,draft_text,draft_source)
  values (v_other_prospect,
    v_other_prospect_channel,
    1,'initial','draft','draft','human')
  returning id into v_outreach;
  begin
    perform public.confirm_sales_scout_outreach_sent(v_outreach,'sent','verify account',now(),v_actor,null);
    raise exception 'unapproved outreach was confirmed';
  exception when sqlstate '22023' then null;
  end;
  delete from public.marketing_prospect_outreaches where id=v_outreach;

  insert into public.marketing_prospect_outreaches
    (prospect_id,channel_id,sequence_number,kind,status,draft_text,approved_text,
     draft_source,approved_at,approved_by)
  values (v_prospect,v_channel,1,'initial','approved','draft','approved',
    'human',now(),gen_random_uuid())
  returning id into v_outreach;
  begin
    perform public.confirm_sales_scout_outreach_sent(
      v_outreach,'must remain approved','verify account',now(),null,null);
    raise exception 'null actor was accepted for send confirmation';
  exception when sqlstate '22023' then
    if sqlerrm<>'actor id is required for send confirmation' then
      raise exception 'unexpected null-actor error: %',sqlerrm;
    end if;
  end;
  if (select status from public.marketing_prospect_outreaches where id=v_outreach)<>'approved' then
    raise exception 'rejected null-actor call changed outreach status';
  end if;
  perform public.confirm_sales_scout_outreach_sent(
    v_outreach,'final sent text','verify account',now(),v_actor,null);

  begin
    insert into public.marketing_prospect_outreaches
      (prospect_id,channel_id,sequence_number,kind,status,draft_text)
    values (v_prospect,v_channel,1,'initial','draft','duplicate');
    raise exception 'duplicate outreach sequence was accepted';
  exception when unique_violation then null;
  end;

  insert into public.marketing_prospect_outreaches
    (prospect_id,channel_id,sequence_number,kind,status,draft_text,approved_text,
     draft_source,approved_at,approved_by)
  values (v_prospect,v_channel,2,'follow_up_1','approved','follow up','follow up',
    'human',now(),gen_random_uuid())
  returning id into v_pending;
  perform public.set_sales_scout_do_not_contact(v_prospect,'verification opt out','verification',v_actor);
  if (select status from public.marketing_prospect_outreaches where id=v_pending)<>'blocked' then
    raise exception 'suppression did not block pending outreach';
  end if;
  if (select status from public.marketing_prospect_outreaches where id=v_outreach)<>'sent' then
    raise exception 'suppression changed sent history';
  end if;
  begin
    perform public.confirm_sales_scout_outreach_sent(v_pending,'must fail','verify account',now(),v_actor,null);
    raise exception 'suppressed prospect was confirmed sent';
  exception when sqlstate '22023' then null;
  end;

  insert into public.orders
    (order_reference,customer_name,customer_email,customer_phone,delivery_address,
     delivery_date,subtotal,delivery_fee,total_amount)
  values ('SSV-'||gen_random_uuid(),'Verify','verify@example.invalid','07000000000',
    'Verification only',current_date,100,0,100) returning id into v_order_one;
  insert into public.orders
    (order_reference,customer_name,customer_email,customer_phone,delivery_address,
     delivery_date,subtotal,delivery_fee,total_amount)
  values ('SSV-'||gen_random_uuid(),'Verify','verify@example.invalid','07000000000',
    'Verification only',current_date,200,0,200) returning id into v_order_two;
  insert into public.marketing_prospect_attributions(prospect_id,order_id,relationship)
  values (v_prospect,v_order_one,'manual'),(v_prospect,v_order_two,'sourced');
  begin
    insert into public.marketing_prospect_attributions(prospect_id,order_id,relationship)
    values (v_prospect,v_order_one,'manual');
    raise exception 'duplicate attribution was accepted';
  exception when unique_violation then null;
  end;

  foreach v_type in array array[
    'note','phone_call','whatsapp','email','meeting','proposal_sent',
    'quotation_sent','follow_up','stage_change','trial_order','won','lost'
  ] loop
    perform public.record_marketing_prospect_activity(
      v_other_prospect,v_type,'verification',now(),null,null);
  end loop;
  perform public.record_marketing_prospect_activity(
    v_other_prospect,'sales_scout','verification',now(),null,null,
    jsonb_build_object('event','scout_scored'));

  update public.marketing_prospects set stage='responded' where id=v_other_prospect;
  if (select stage from public.marketing_prospects where id=v_other_prospect)<>'responded' then
    raise exception 'existing stage value failed';
  end if;
end $$;

select 'sales_scout_foundation' as verification, 'passed' as result;
rollback;
