-- Commercial Operations Batch 4.1: durable Admin-only prospect activity history.
-- Does not create orders, revenue, payments, inventory movements, or customer messages.

create table if not exists public.marketing_prospect_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.marketing_prospects(id) on delete cascade,
  activity_type text not null check (activity_type in ('note','phone_call','whatsapp','email','meeting','proposal_sent','quotation_sent','follow_up','stage_change','trial_order','won','lost')),
  stage_from text check (stage_from is null or stage_from in ('identified','contacted','responded','requirements_received','proposal_sent','negotiating','trial_order','recurring_customer','won','lost')),
  stage_to text check (stage_to is null or stage_to in ('identified','contacted','responded','requirements_received','proposal_sent','negotiating','trial_order','recurring_customer','won','lost')),
  summary text not null check (char_length(trim(summary)) between 1 and 2000),
  occurred_at timestamptz not null default now(),
  next_follow_up_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists marketing_prospect_activities_prospect_occurred_idx
  on public.marketing_prospect_activities(prospect_id, occurred_at desc);

alter table public.marketing_prospect_activities enable row level security;
revoke all on public.marketing_prospect_activities from anon, authenticated;

comment on table public.marketing_prospect_activities is
  'Admin-entered prospect history. It does not create revenue, orders, or customer notifications.';

