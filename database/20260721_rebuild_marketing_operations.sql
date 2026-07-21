-- Commercial Operations Batch 4.1C: definitive prospect and social workflow rebuild.
-- Repeat-safe; preserves valid records and never changes commerce or financial tables.

do $$ declare r record; begin
  for r in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('change_marketing_prospect_stage','transition_marketing_prospect','record_marketing_prospect_activity','complete_marketing_prospect_follow_up','test_marketing_operations') loop
    execute format('drop function if exists %I.%I(%s) restrict',r.nspname,r.proname,r.args);
  end loop;
end $$;

alter table public.marketing_prospect_activities add column if not exists next_follow_up_at timestamptz;
alter table public.marketing_prospect_activities add column if not exists created_by uuid;
alter table public.marketing_social_activities add column if not exists campaign_id uuid references public.marketing_campaigns(id) on delete set null;
alter table public.marketing_social_activities add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.marketing_social_activities add column if not exists publication_url text;
alter table public.marketing_social_activities add column if not exists scheduled_at timestamptz;
alter table public.marketing_social_activities add column if not exists published_at timestamptz;
alter table public.marketing_social_activities add column if not exists reach bigint;
alter table public.marketing_social_activities add column if not exists impressions bigint;
alter table public.marketing_social_activities add column if not exists likes bigint;
alter table public.marketing_social_activities add column if not exists comments bigint;
alter table public.marketing_social_activities add column if not exists shares bigint;
alter table public.marketing_social_activities add column if not exists saves bigint;
alter table public.marketing_social_activities add column if not exists direct_message_leads integer;
alter table public.marketing_social_activities add column if not exists attributed_orders integer;
alter table public.marketing_social_activities add column if not exists notes text;
alter table public.marketing_social_activities add column if not exists created_at timestamptz not null default now();
alter table public.marketing_social_activities add column if not exists updated_at timestamptz not null default now();
create index if not exists marketing_social_scheduled_idx on public.marketing_social_activities(status,scheduled_at);
alter table public.marketing_social_activities enable row level security;
revoke all on public.marketing_social_activities from public,anon,authenticated;
grant select,insert,update,delete on public.marketing_social_activities to service_role;

create or replace function public.transition_marketing_prospect(p_prospect_id uuid,p_target_stage text,p_summary text default null,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_previous_stage text;v_target_stage text:=lower(trim(p_target_stage));v_activity_type text;v_now timestamptz:=now();v_activity_id uuid;
begin
  if v_target_stage not in ('identified','contacted','responded','requirements_received','proposal_sent','negotiating','trial_order','recurring_customer','won','lost') then raise exception using errcode='22023',message='invalid prospect stage';end if;
  select mp.stage into v_previous_stage from public.marketing_prospects as mp where mp.id=p_prospect_id for update;
  if not found then raise exception using errcode='P0002',message='prospect not found';end if;
  if v_previous_stage=v_target_stage then return jsonb_build_object('ok',true,'changed',false,'prospect_id',p_prospect_id,'previous_stage',v_previous_stage,'current_stage',v_target_stage,'activity_id',null);end if;
  update public.marketing_prospects as mp set stage=v_target_stage,updated_at=v_now where mp.id=p_prospect_id;
  v_activity_type:=case when v_target_stage='won' then 'won' when v_target_stage='lost' then 'lost' when v_target_stage='trial_order' then 'trial_order' else 'stage_change' end;
  insert into public.marketing_prospect_activities as mpa(prospect_id,activity_type,stage_from,stage_to,summary,occurred_at,created_by) values(p_prospect_id,v_activity_type,v_previous_stage,v_target_stage,coalesce(nullif(trim(p_summary),''),'Stage changed from '||v_previous_stage||' to '||v_target_stage||'.'),v_now,p_actor_id) returning mpa.id into v_activity_id;
  return jsonb_build_object('ok',true,'changed',true,'prospect_id',p_prospect_id,'previous_stage',v_previous_stage,'current_stage',v_target_stage,'activity_id',v_activity_id);
end $$;

create or replace function public.record_marketing_prospect_activity(p_prospect_id uuid,p_activity_type text,p_summary text,p_occurred_at timestamptz default null,p_next_follow_up_at timestamptz default null,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_activity_type text:=lower(trim(p_activity_type));v_occurred_at timestamptz:=coalesce(p_occurred_at,now());v_activity_id uuid;
begin
  if v_activity_type not in ('note','phone_call','whatsapp','email','meeting','proposal_sent','quotation_sent','follow_up','stage_change','trial_order','won','lost') then raise exception using errcode='22023',message='invalid activity type';end if;
  if nullif(trim(p_summary),'') is null then raise exception using errcode='22023',message='activity summary required';end if;
  perform 1 from public.marketing_prospects as mp where mp.id=p_prospect_id for update;
  if not found then raise exception using errcode='P0002',message='prospect not found';end if;
  insert into public.marketing_prospect_activities as mpa(prospect_id,activity_type,summary,occurred_at,next_follow_up_at,created_by) values(p_prospect_id,v_activity_type,p_summary,v_occurred_at,p_next_follow_up_at,p_actor_id) returning mpa.id into v_activity_id;
  update public.marketing_prospects as mp set last_contact_at=case when v_activity_type in ('phone_call','whatsapp','email','meeting','follow_up') then v_occurred_at else mp.last_contact_at end,assigned_follow_up_at=coalesce(p_next_follow_up_at,mp.assigned_follow_up_at),updated_at=now() where mp.id=p_prospect_id;
  return jsonb_build_object('ok',true,'prospect_id',p_prospect_id,'activity_id',v_activity_id,'activity_type',v_activity_type,'occurred_at',v_occurred_at,'next_follow_up_at',p_next_follow_up_at);
end $$;

create or replace function public.complete_marketing_prospect_follow_up(p_prospect_id uuid,p_summary text default 'Scheduled follow-up completed.',p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_now timestamptz:=now();v_activity_id uuid;
begin
  perform 1 from public.marketing_prospects as mp where mp.id=p_prospect_id for update;
  if not found then raise exception using errcode='P0002',message='prospect not found';end if;
  insert into public.marketing_prospect_activities as mpa(prospect_id,activity_type,summary,occurred_at,created_by) values(p_prospect_id,'follow_up',coalesce(nullif(trim(p_summary),''),'Scheduled follow-up completed.'),v_now,p_actor_id) returning mpa.id into v_activity_id;
  update public.marketing_prospects as mp set assigned_follow_up_at=null,last_contact_at=v_now,updated_at=v_now where mp.id=p_prospect_id;
  return jsonb_build_object('ok',true,'prospect_id',p_prospect_id,'activity_id',v_activity_id,'completed_at',v_now);
end $$;

revoke all on function public.transition_marketing_prospect(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.complete_marketing_prospect_follow_up(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.transition_marketing_prospect(uuid,text,text,uuid) to service_role;
grant execute on function public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid) to service_role;
grant execute on function public.complete_marketing_prospect_follow_up(uuid,text,uuid) to service_role;

create or replace function public.test_marketing_operations() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_token text:='__marketing_self_test_'||gen_random_uuid()::text;v_prospect uuid;v_social uuid;v_steps jsonb:='{}'::jsonb;v_orders bigint;v_paid numeric;v_inventory bigint;v_result jsonb;
begin
  select count(*),coalesce(sum(total_amount),0) into v_orders,v_paid from public.orders where payment_status='paid';select count(*) into v_inventory from public.inventory_movements;
  insert into public.marketing_prospects(business_name,stage,source,notes) values(v_token,'identified','system_self_test',v_token) returning id into v_prospect;v_steps:=v_steps||jsonb_build_object('prospect_create',true);
  v_result:=public.transition_marketing_prospect(v_prospect,'contacted','Self-test transition',null);v_steps:=v_steps||jsonb_build_object('stage_transition',(v_result->>'changed')::boolean);
  perform public.record_marketing_prospect_activity(v_prospect,'whatsapp','Self-test WhatsApp',now(),now()+interval '1 day',null);v_steps:=v_steps||jsonb_build_object('activity_recording',true,'follow_up_schedule',true);
  perform public.complete_marketing_prospect_follow_up(v_prospect,'Self-test follow-up complete',null);v_steps:=v_steps||jsonb_build_object('follow_up_completion',true);
  perform public.transition_marketing_prospect(v_prospect,'lost','Self-test lost',null);perform public.transition_marketing_prospect(v_prospect,'identified','Self-test reopen',null);v_steps:=v_steps||jsonb_build_object('lost_reopen',true);
  insert into public.marketing_social_activities(platform,content_type,status,notes) values('self_test','self_test','planned',v_token) returning id into v_social;v_steps:=v_steps||jsonb_build_object('social_create',true);
  update public.marketing_social_activities set status='scheduled',scheduled_at=now(),updated_at=now() where id=v_social;v_steps:=v_steps||jsonb_build_object('social_schedule',true);
  update public.marketing_social_activities set status='published',published_at=now(),reach=0,impressions=0,likes=0,comments=0,shares=0,saves=0,direct_message_leads=0,attributed_orders=0,updated_at=now() where id=v_social;v_steps:=v_steps||jsonb_build_object('social_publish',true,'social_metrics',true);
  delete from public.marketing_social_activities where id=v_social;delete from public.marketing_prospects where id=v_prospect;v_steps:=v_steps||jsonb_build_object('cleanup',not exists(select 1 from public.marketing_prospects where id=v_prospect) and not exists(select 1 from public.marketing_social_activities where id=v_social));
  if v_orders<>(select count(*) from public.orders where payment_status='paid') or v_paid<>(select coalesce(sum(total_amount),0) from public.orders where payment_status='paid') or v_inventory<>(select count(*) from public.inventory_movements) then raise exception 'commerce invariant changed';end if;
  return jsonb_build_object('ok',true,'steps',v_steps,'temporary_records_remaining',false,'commerce_unchanged',true);
exception when others then return jsonb_build_object('ok',false,'steps',v_steps,'error_code',sqlstate,'temporary_records_remaining',false);
end $$;
revoke all on function public.test_marketing_operations() from public,anon,authenticated;
grant execute on function public.test_marketing_operations() to service_role;
notify pgrst,'reload schema';
