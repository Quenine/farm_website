-- Shields Farms Sales Scout Batch 2: persistence foundation.
-- Repeat-safe. Does not send outreach or change order, payment, or inventory behaviour.

begin;

-- These shared marketing definitions make the reconciled baseline self-contained
-- and are harmless against the confirmed production baseline.
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  channel text not null,
  source text not null,
  medium text not null,
  campaign_name text not null,
  content text,
  term text,
  target_path text not null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaigns_internal_target
    check (target_path like '/%' and target_path not like '//%')
);

create table if not exists public.marketing_prospects (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  business_category text,
  contact_person text,
  contact_email text,
  contact_phone text,
  stage text not null default 'identified'
    check (stage in ('identified','contacted','responded','requirements_received','proposal_sent','negotiating','trial_order','recurring_customer','won','lost')),
  requirements text,
  estimated_value numeric(12,2) check (estimated_value is null or estimated_value >= 0),
  expected_frequency text,
  source text,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  assigned_follow_up_at timestamptz,
  last_contact_at timestamptz,
  notes text,
  inquiry_id uuid references public.contact_inquiries(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_prospect_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.marketing_prospects(id) on delete cascade,
  activity_type text not null,
  stage_from text check (stage_from is null or stage_from in ('identified','contacted','responded','requirements_received','proposal_sent','negotiating','trial_order','recurring_customer','won','lost')),
  stage_to text check (stage_to is null or stage_to in ('identified','contacted','responded','requirements_received','proposal_sent','negotiating','trial_order','recurring_customer','won','lost')),
  summary text not null check (char_length(trim(summary)) between 1 and 2000),
  occurred_at timestamptz not null default now(),
  next_follow_up_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.marketing_prospects
  add column if not exists scout_status text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists location_evidence jsonb,
  add column if not exists service_area_cities text[],
  add column if not exists discovery_source text,
  add column if not exists discovery_source_id text,
  add column if not exists source_url text,
  add column if not exists discovered_at timestamptz,
  add column if not exists website_host text,
  add column if not exists contact_email_normalized text,
  add column if not exists contact_phone_normalized text,
  add column if not exists profile_last_activity_at timestamptz,
  add column if not exists has_recurring_produce_demand boolean,
  add column if not exists recurring_demand_evidence text,
  add column if not exists demand_band text,
  add column if not exists appears_inactive_or_closed boolean,
  add column if not exists is_consumer_only boolean,
  add column if not exists score integer,
  add column if not exists score_version text,
  add column if not exists score_factors jsonb,
  add column if not exists scored_at timestamptz,
  add column if not exists do_not_contact_at timestamptz,
  add column if not exists do_not_contact_reason text,
  add column if not exists do_not_contact_source text,
  add column if not exists do_not_contact_by uuid,
  add column if not exists handover_status text,
  add column if not exists handover_ready_at timestamptz,
  add column if not exists handover_accepted_at timestamptz,
  add column if not exists handover_completed_at timestamptz,
  add column if not exists handover_reason text,
  add column if not exists created_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_prospects'::regclass and conname='marketing_prospects_scout_status_check') then
    alter table public.marketing_prospects add constraint marketing_prospects_scout_status_check
      check (scout_status is null or scout_status in ('new','researching','qualified','disqualified','engaged','converted','closed','do_not_contact'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_prospects'::regclass and conname='marketing_prospects_handover_status_check') then
    alter table public.marketing_prospects add constraint marketing_prospects_handover_status_check
      check (handover_status is null or handover_status in ('not_ready','ready','accepted','in_progress','completed','declined'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_prospects'::regclass and conname='marketing_prospects_demand_band_check') then
    alter table public.marketing_prospects add constraint marketing_prospects_demand_band_check
      check (demand_band is null or demand_band in ('high','medium','low','unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_prospects'::regclass and conname='marketing_prospects_score_check') then
    alter table public.marketing_prospects add constraint marketing_prospects_score_check
      check (score is null or score between 0 and 100);
  end if;
end $$;

create index if not exists marketing_prospects_scout_queue_idx
  on public.marketing_prospects(scout_status, country, state, city, score desc)
  where scout_status is not null;
create index if not exists marketing_prospects_scout_follow_up_idx
  on public.marketing_prospects(assigned_follow_up_at)
  where scout_status is not null and assigned_follow_up_at is not null;

create table if not exists public.marketing_sales_scout_campaigns (
  campaign_id uuid primary key references public.marketing_campaigns(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','active','paused','completed')),
  city text not null check (char_length(trim(city)) > 0),
  state text,
  country text not null check (char_length(trim(country)) > 0),
  target_categories text[] not null check (cardinality(target_categories) > 0),
  product_scope text,
  delivery_summary text,
  daily_review_target integer not null check (daily_review_target > 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_prospect_channels (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.marketing_prospects(id) on delete cascade,
  platform text not null
    check (platform in ('instagram','facebook','tiktok','x','youtube','website','email','phone','whatsapp','other')),
  handle_or_value text not null,
  identity_key text not null check (char_length(trim(identity_key)) > 0),
  profile_url text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  verified_at timestamptz,
  source text,
  source_id text,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_prospect_channels_prospect_id_id_key unique (prospect_id, id)
);

create unique index if not exists marketing_prospect_channels_active_identity_uidx
  on public.marketing_prospect_channels(platform, identity_key)
  where is_active;
create unique index if not exists marketing_prospect_channels_provider_identity_uidx
  on public.marketing_prospect_channels(source, source_id)
  where source is not null and source_id is not null;
create unique index if not exists marketing_prospect_channels_active_primary_uidx
  on public.marketing_prospect_channels(prospect_id)
  where is_active and is_primary;
create index if not exists marketing_prospect_channels_prospect_idx
  on public.marketing_prospect_channels(prospect_id, is_active);

create table if not exists public.marketing_prospect_outreaches (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.marketing_prospects(id) on delete cascade,
  channel_id uuid not null references public.marketing_prospect_channels(id) on delete restrict,
  sequence_number smallint not null check (sequence_number between 1 and 3),
  kind text not null check (kind in ('initial','follow_up_1','follow_up_2')),
  status text not null default 'draft'
    check (status in ('draft','approved','sent','replied','no_response','cancelled','blocked')),
  draft_text text,
  approved_text text,
  sent_text text,
  personalization_facts jsonb not null default '{}'::jsonb,
  draft_source text not null default 'human' check (draft_source in ('human','assistant')),
  approved_at timestamptz,
  approved_by uuid,
  sent_at timestamptz,
  sent_by uuid,
  sender_account_label text,
  platform_reference text,
  due_at timestamptz,
  reply_summary text,
  reply_sentiment text
    check (reply_sentiment is null or reply_sentiment in ('interested','warm','neutral','not_interested','opt_out','irrelevant')),
  commercial_signal boolean,
  replied_at timestamptz,
  recorded_by uuid,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_prospect_outreaches_sequence_kind_check check (
    (sequence_number=1 and kind='initial') or
    (sequence_number=2 and kind='follow_up_1') or
    (sequence_number=3 and kind='follow_up_2')
  ),
  constraint marketing_prospect_outreaches_approval_check check (
    status not in ('approved','sent','replied','no_response') or
    (nullif(trim(approved_text),'') is not null and approved_at is not null and approved_by is not null)
  ),
  constraint marketing_prospect_outreaches_sent_check check (
    status not in ('sent','replied','no_response') or
    (nullif(trim(sent_text),'') is not null and sent_at is not null and sent_by is not null and nullif(trim(sender_account_label),'') is not null)
  ),
  constraint marketing_prospect_outreaches_prospect_channel_sequence_key
    unique (prospect_id, channel_id, sequence_number),
  constraint marketing_prospect_outreaches_channel_owner_fkey
    foreign key (prospect_id, channel_id)
    references public.marketing_prospect_channels(prospect_id, id) on delete restrict
);

create index if not exists marketing_prospect_outreaches_due_idx
  on public.marketing_prospect_outreaches(due_at, status)
  where due_at is not null and status in ('approved','no_response');

create table if not exists public.marketing_prospect_attributions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.marketing_prospects(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  relationship text not null check (relationship in ('sourced','influenced','manual')),
  status text not null default 'linked' check (status in ('linked','paid','invalidated')),
  linked_at timestamptz not null default now(),
  linked_by uuid,
  paid_at timestamptz,
  paid_amount numeric(12,2) check (paid_amount is null or paid_amount >= 0),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_prospect_attributions_prospect_order_key unique (prospect_id, order_id)
);

alter table public.marketing_prospect_activities
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.marketing_prospect_activities
  drop constraint if exists marketing_prospect_activities_activity_type_check;
alter table public.marketing_prospect_activities
  add constraint marketing_prospect_activities_activity_type_check
  check (activity_type in ('note','phone_call','whatsapp','email','meeting','proposal_sent','quotation_sent','follow_up','stage_change','trial_order','won','lost','sales_scout'));

create index if not exists marketing_prospect_activities_prospect_occurred_idx
  on public.marketing_prospect_activities(prospect_id, occurred_at desc);

alter table public.marketing_sales_scout_campaigns enable row level security;
alter table public.marketing_prospect_channels enable row level security;
alter table public.marketing_prospect_outreaches enable row level security;
alter table public.marketing_prospect_attributions enable row level security;
alter table public.marketing_prospects enable row level security;
alter table public.marketing_prospect_activities enable row level security;

revoke all on public.marketing_sales_scout_campaigns, public.marketing_prospect_channels,
  public.marketing_prospect_outreaches, public.marketing_prospect_attributions
  from public, anon, authenticated;
grant select,insert,update,delete on public.marketing_sales_scout_campaigns,
  public.marketing_prospect_channels, public.marketing_prospect_outreaches,
  public.marketing_prospect_attributions to service_role;

revoke all on public.marketing_prospects, public.marketing_prospect_activities
  from public, anon, authenticated;
grant select,insert,update,delete on public.marketing_prospects,
  public.marketing_prospect_activities to service_role;

drop trigger if exists marketing_sales_scout_campaigns_set_updated_at on public.marketing_sales_scout_campaigns;
create trigger marketing_sales_scout_campaigns_set_updated_at
before update on public.marketing_sales_scout_campaigns
for each row execute function public.set_updated_at();
drop trigger if exists marketing_prospect_channels_set_updated_at on public.marketing_prospect_channels;
create trigger marketing_prospect_channels_set_updated_at
before update on public.marketing_prospect_channels
for each row execute function public.set_updated_at();
drop trigger if exists marketing_prospect_outreaches_set_updated_at on public.marketing_prospect_outreaches;
create trigger marketing_prospect_outreaches_set_updated_at
before update on public.marketing_prospect_outreaches
for each row execute function public.set_updated_at();
drop trigger if exists marketing_prospect_attributions_set_updated_at on public.marketing_prospect_attributions;
create trigger marketing_prospect_attributions_set_updated_at
before update on public.marketing_prospect_attributions
for each row execute function public.set_updated_at();

-- Existing six-argument callers retain their signature and defaults.
create or replace function public.record_marketing_prospect_activity(
  p_prospect_id uuid,
  p_activity_type text,
  p_summary text,
  p_occurred_at timestamptz default null,
  p_next_follow_up_at timestamptz default null,
  p_actor_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_activity_type text:=lower(trim(p_activity_type));
  v_occurred_at timestamptz:=coalesce(p_occurred_at,now());
  v_activity_id uuid;
begin
  if v_activity_type not in ('note','phone_call','whatsapp','email','meeting','proposal_sent','quotation_sent','follow_up','stage_change','trial_order','won','lost','sales_scout') then
    raise exception using errcode='22023',message='invalid activity type';
  end if;
  if nullif(trim(p_summary),'') is null then
    raise exception using errcode='22023',message='activity summary required';
  end if;
  perform 1 from public.marketing_prospects as mp where mp.id=p_prospect_id for update;
  if not found then raise exception using errcode='P0002',message='prospect not found'; end if;
  insert into public.marketing_prospect_activities
    (prospect_id,activity_type,summary,occurred_at,next_follow_up_at,created_by,metadata)
  values
    (p_prospect_id,v_activity_type,p_summary,v_occurred_at,p_next_follow_up_at,p_actor_id,'{}'::jsonb)
  returning id into v_activity_id;
  update public.marketing_prospects
  set last_contact_at=case when v_activity_type in ('phone_call','whatsapp','email','meeting','follow_up') then v_occurred_at else last_contact_at end,
      assigned_follow_up_at=coalesce(p_next_follow_up_at,assigned_follow_up_at),
      updated_at=now()
  where id=p_prospect_id;
  return jsonb_build_object('ok',true,'prospect_id',p_prospect_id,'activity_id',v_activity_id,
    'activity_type',v_activity_type,'occurred_at',v_occurred_at,'next_follow_up_at',p_next_follow_up_at);
end $$;

-- Metadata-aware overload. Metadata is explicit to avoid ambiguous legacy calls.
create or replace function public.record_marketing_prospect_activity(
  p_prospect_id uuid,
  p_activity_type text,
  p_summary text,
  p_occurred_at timestamptz,
  p_next_follow_up_at timestamptz,
  p_actor_id uuid,
  p_metadata jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_activity_type text:=lower(trim(p_activity_type));
  v_occurred_at timestamptz:=coalesce(p_occurred_at,now());
  v_activity_id uuid;
begin
  if v_activity_type not in ('note','phone_call','whatsapp','email','meeting','proposal_sent','quotation_sent','follow_up','stage_change','trial_order','won','lost','sales_scout') then
    raise exception using errcode='22023',message='invalid activity type';
  end if;
  if nullif(trim(p_summary),'') is null then
    raise exception using errcode='22023',message='activity summary required';
  end if;
  if p_metadata is not null and jsonb_typeof(p_metadata)<>'object' then
    raise exception using errcode='22023',message='activity metadata must be an object';
  end if;
  perform 1 from public.marketing_prospects where id=p_prospect_id for update;
  if not found then raise exception using errcode='P0002',message='prospect not found'; end if;
  insert into public.marketing_prospect_activities
    (prospect_id,activity_type,summary,occurred_at,next_follow_up_at,created_by,metadata)
  values
    (p_prospect_id,v_activity_type,p_summary,v_occurred_at,p_next_follow_up_at,p_actor_id,coalesce(p_metadata,'{}'::jsonb))
  returning id into v_activity_id;
  update public.marketing_prospects
  set last_contact_at=case when v_activity_type in ('phone_call','whatsapp','email','meeting','follow_up') then v_occurred_at else last_contact_at end,
      assigned_follow_up_at=coalesce(p_next_follow_up_at,assigned_follow_up_at),
      updated_at=now()
  where id=p_prospect_id;
  return jsonb_build_object('ok',true,'prospect_id',p_prospect_id,'activity_id',v_activity_id,
    'activity_type',v_activity_type,'occurred_at',v_occurred_at,'next_follow_up_at',p_next_follow_up_at);
end $$;

create or replace function public.set_sales_scout_do_not_contact(
  p_prospect_id uuid,
  p_reason text,
  p_source text,
  p_actor_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_now timestamptz:=now();
  v_already_suppressed boolean;
  v_blocked integer:=0;
  v_activity_id uuid;
begin
  if nullif(trim(p_reason),'') is null or nullif(trim(p_source),'') is null then
    raise exception using errcode='22023',message='nonblank reason and source are required';
  end if;
  select (scout_status='do_not_contact' and do_not_contact_at is not null)
    into v_already_suppressed
  from public.marketing_prospects where id=p_prospect_id for update;
  if not found then raise exception using errcode='P0002',message='prospect not found'; end if;

  update public.marketing_prospect_outreaches
  set status='blocked',cancel_reason='Prospect is do not contact.',updated_at=v_now
  where prospect_id=p_prospect_id and status in ('draft','approved','no_response');
  get diagnostics v_blocked=row_count;
  if v_already_suppressed then
    return jsonb_build_object('ok',true,'changed',false,'prospect_id',p_prospect_id,'blocked_outreaches',v_blocked);
  end if;
  update public.marketing_prospects
  set scout_status='do_not_contact',do_not_contact_at=v_now,
      do_not_contact_reason=trim(p_reason),do_not_contact_source=trim(p_source),
      do_not_contact_by=p_actor_id,updated_at=v_now
  where id=p_prospect_id;
  insert into public.marketing_prospect_activities
    (prospect_id,activity_type,summary,occurred_at,created_by,metadata)
  values
    (p_prospect_id,'sales_scout','Prospect marked do not contact.',v_now,p_actor_id,
     jsonb_build_object('event','do_not_contact','reason',trim(p_reason),'source',trim(p_source),'blocked_outreaches',v_blocked))
  returning id into v_activity_id;
  return jsonb_build_object('ok',true,'changed',true,'prospect_id',p_prospect_id,
    'blocked_outreaches',v_blocked,'activity_id',v_activity_id);
end $$;

create or replace function public.confirm_sales_scout_outreach_sent(
  p_outreach_id uuid,
  p_sent_text text,
  p_sender_account_label text,
  p_sent_at timestamptz default null,
  p_actor_id uuid default null,
  p_platform_reference text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prospect public.marketing_prospects%rowtype;
  v_outreach public.marketing_prospect_outreaches%rowtype;
  v_sent_at timestamptz:=coalesce(p_sent_at,now());
  v_attempt_count integer;
  v_activity_id uuid;
begin
  if p_actor_id is null then
    raise exception using errcode='22023',message='actor id is required for send confirmation';
  end if;
  if nullif(trim(p_sent_text),'') is null or nullif(trim(p_sender_account_label),'') is null then
    raise exception using errcode='22023',message='final sent text and sender account label are required';
  end if;
  select mp.* into v_prospect
  from public.marketing_prospects mp
  join public.marketing_prospect_outreaches mpo on mpo.prospect_id=mp.id
  where mpo.id=p_outreach_id for update of mp;
  if not found then raise exception using errcode='P0002',message='outreach not found'; end if;
  select * into v_outreach from public.marketing_prospect_outreaches
  where id=p_outreach_id for update;
  if not found then raise exception using errcode='P0002',message='outreach not found'; end if;
  if v_prospect.scout_status in ('do_not_contact','disqualified','converted','closed')
     or v_prospect.do_not_contact_at is not null then
    raise exception using errcode='22023',message='prospect is not eligible for outreach';
  end if;
  if v_outreach.status<>'approved' then
    raise exception using errcode='22023',message='outreach must be approved before send confirmation';
  end if;
  if v_outreach.sequence_number not between 1 and 3 then
    raise exception using errcode='22023',message='invalid outreach sequence';
  end if;
  if v_outreach.sequence_number>1 and not exists (
    select 1 from public.marketing_prospect_outreaches previous
    where previous.prospect_id=v_outreach.prospect_id
      and previous.channel_id=v_outreach.channel_id
      and previous.sequence_number=v_outreach.sequence_number-1
      and previous.status in ('sent','replied','no_response')
  ) then
    raise exception using errcode='22023',message='previous outreach sequence has not been sent';
  end if;
  select count(*) into v_attempt_count
  from public.marketing_prospect_outreaches
  where prospect_id=v_outreach.prospect_id and channel_id=v_outreach.channel_id
    and status in ('sent','replied','no_response');
  if v_attempt_count>=3 then
    raise exception using errcode='22023',message='maximum outreach attempts reached';
  end if;
  if exists (
    select 1 from public.marketing_prospect_outreaches duplicate_attempt
    where duplicate_attempt.prospect_id=v_outreach.prospect_id
      and duplicate_attempt.channel_id=v_outreach.channel_id
      and duplicate_attempt.sequence_number=v_outreach.sequence_number
      and duplicate_attempt.id<>v_outreach.id
      and duplicate_attempt.status in ('sent','replied','no_response')
  ) then
    raise exception using errcode='23505',message='outreach sequence already sent';
  end if;

  update public.marketing_prospect_outreaches
  set status='sent',sent_text=trim(p_sent_text),sent_at=v_sent_at,sent_by=p_actor_id,
      sender_account_label=trim(p_sender_account_label),
      platform_reference=nullif(trim(p_platform_reference),''),
      updated_at=now()
  where id=p_outreach_id;
  update public.marketing_prospects
  set stage=case when v_outreach.sequence_number=1 and stage='identified' then 'contacted' else stage end,
      last_contact_at=v_sent_at,updated_at=now()
  where id=v_outreach.prospect_id;
  insert into public.marketing_prospect_activities
    (prospect_id,activity_type,stage_from,stage_to,summary,occurred_at,created_by,metadata)
  values
    (v_outreach.prospect_id,'sales_scout',
     case when v_outreach.sequence_number=1 and v_prospect.stage='identified' then 'identified' else null end,
     case when v_outreach.sequence_number=1 and v_prospect.stage='identified' then 'contacted' else null end,
     'Manual social outreach send recorded.',v_sent_at,p_actor_id,
     jsonb_build_object('event','outreach_sent','outreach_id',p_outreach_id,
       'channel_id',v_outreach.channel_id,'sequence_number',v_outreach.sequence_number,
       'platform_delivery_claimed',false))
  returning id into v_activity_id;
  return jsonb_build_object('ok',true,'outreach_id',p_outreach_id,
    'prospect_id',v_outreach.prospect_id,'sent_at',v_sent_at,'activity_id',v_activity_id);
end $$;

revoke all on function public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.set_sales_scout_do_not_contact(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.confirm_sales_scout_outreach_sent(uuid,text,text,timestamptz,uuid,text) from public,anon,authenticated;
grant execute on function public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid) to service_role;
grant execute on function public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid,jsonb) to service_role;
grant execute on function public.set_sales_scout_do_not_contact(uuid,text,text,uuid) to service_role;
grant execute on function public.confirm_sales_scout_outreach_sent(uuid,text,text,timestamptz,uuid,text) to service_role;

insert into public.marketing_campaigns
  (name,slug,channel,source,medium,campaign_name,target_path,is_active)
values
  ('Lagos Food Businesses — Launch Campaign','sales-scout-lagos-food-businesses-launch',
   'social_outreach','sales_scout','manual_social_message',
   'sales-scout-lagos-food-businesses-launch','/admin/marketing/sales-scout',false)
on conflict (slug) do nothing;

insert into public.marketing_sales_scout_campaigns
  (campaign_id,status,city,state,country,target_categories,product_scope,
   delivery_summary,daily_review_target)
select id,'draft','Lagos','Lagos','Nigeria',
  array['Restaurant','Caterer','Hotel','Supermarket','Food Vendor']::text[],
  'All current Shields Farms products',
  'Nationwide delivery subject to quantity, logistics, quotation and confirmation',
  25
from public.marketing_campaigns
where slug='sales-scout-lagos-food-businesses-launch'
on conflict (campaign_id) do nothing;

notify pgrst,'reload schema';
commit;
