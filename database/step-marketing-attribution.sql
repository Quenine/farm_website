-- Marketing attribution and campaign tracking schema.
-- Repeat-safe. Run once per brand Supabase project.

alter table public.orders
  add column if not exists first_touch_attribution jsonb,
  add column if not exists last_touch_attribution jsonb;

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
  constraint marketing_campaigns_internal_target check (target_path like '/%' and target_path not like '//%')
);

create table if not exists public.marketing_campaign_clicks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  landing_path text,
  referrer text,
  user_agent_family text
);

create index if not exists marketing_campaigns_slug_idx on public.marketing_campaigns(slug);
create index if not exists marketing_campaign_clicks_campaign_idx on public.marketing_campaign_clicks(campaign_id, clicked_at desc);
create index if not exists orders_first_touch_campaign_idx on public.orders ((first_touch_attribution ->> 'utm_campaign'));
create index if not exists orders_last_touch_campaign_idx on public.orders ((last_touch_attribution ->> 'utm_campaign'));

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_clicks enable row level security;
