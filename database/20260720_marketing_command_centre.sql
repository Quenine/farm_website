-- Commercial Operations Batch 4: corrective marketing operations storage.
-- Repeat-safe. Does not change orders, payments, prices, inventory, or delivery calculations.

create table if not exists public.marketing_campaign_spend (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  spend_date date not null,
  spend_type text not null check (spend_type in ('paid_social','printed_flyers','design','creator_influencer','photography_video','delivery_subsidy','other')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_prospects (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  business_category text,
  contact_person text,
  contact_email text,
  contact_phone text,
  stage text not null default 'identified' check (stage in ('identified','contacted','responded','requirements_received','proposal_sent','negotiating','trial_order','recurring_customer','won','lost')),
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

create table if not exists public.marketing_social_activities (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  content_type text not null,
  publication_url text,
  scheduled_at timestamptz,
  published_at timestamptz,
  status text not null default 'planned' check (status in ('planned','scheduled','published','cancelled')),
  reach bigint check (reach is null or reach >= 0),
  impressions bigint check (impressions is null or impressions >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  shares bigint check (shares is null or shares >= 0),
  saves bigint check (saves is null or saves >= 0),
  direct_message_leads integer check (direct_message_leads is null or direct_message_leads >= 0),
  attributed_orders integer check (attributed_orders is null or attributed_orders >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners(id) on delete restrict,
  offer_id uuid references public.affiliate_offers(id) on delete set null,
  external_transaction_reference text not null,
  conversion_date date not null,
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected','reversed')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id, external_transaction_reference)
);

create index if not exists marketing_campaign_spend_campaign_date_idx on public.marketing_campaign_spend(campaign_id, spend_date desc);
create index if not exists marketing_prospects_stage_follow_up_idx on public.marketing_prospects(stage, assigned_follow_up_at);
create index if not exists marketing_prospects_campaign_idx on public.marketing_prospects(campaign_id);
create index if not exists marketing_social_scheduled_idx on public.marketing_social_activities(status, scheduled_at);
create index if not exists marketing_social_product_idx on public.marketing_social_activities(product_id, published_at desc);
create index if not exists affiliate_conversions_partner_date_idx on public.affiliate_conversions(partner_id, conversion_date desc);

alter table public.marketing_campaign_spend enable row level security;
alter table public.marketing_prospects enable row level security;
alter table public.marketing_social_activities enable row level security;
alter table public.affiliate_conversions enable row level security;
revoke all on public.marketing_campaign_spend, public.marketing_prospects, public.marketing_social_activities, public.affiliate_conversions from anon, authenticated;

comment on table public.marketing_campaign_spend is 'Admin-entered campaign costs; absence means spend and revenue-to-spend ratio are unavailable.';
comment on table public.marketing_social_activities is 'Admin-entered social activity and manually reported platform metrics; not independently verified.';
comment on table public.affiliate_conversions is 'Merchant-supplied conversion and commission records; never inferred from clicks.';
