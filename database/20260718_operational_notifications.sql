-- Durable operational notifications and Web Push subscriptions.
-- Apply after the core commerce, Contact, and content migrations.

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  type text not null,
  severity text not null check (severity in ('info','success','warning','critical')),
  title text not null check (length(title) between 1 and 160),
  message text not null check (length(message) between 1 and 500),
  target_url text,
  entity_type text,
  entity_id uuid,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique(site, dedupe_key)
);

create table if not exists public.app_notification_reads (
  notification_id uuid not null references public.app_notifications(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  archived_at timestamptz,
  primary key (notification_id, admin_user_id)
);

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  admin_user_id uuid references auth.users(id) on delete cascade,
  context text not null check (context in ('admin','customer')),
  endpoint text not null,
  endpoint_hash text not null,
  p256dh text not null,
  auth_key text not null,
  enabled boolean not null default true,
  preferences jsonb not null default '{"transactional":true,"marketing":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0 check (failure_count between 0 and 100),
  revoked_at timestamptz,
  unique(site, endpoint_hash)
);

create table if not exists public.order_push_subscriptions (
  order_id uuid not null references public.orders(id) on delete cascade,
  subscription_id uuid not null references public.web_push_subscriptions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(order_id, subscription_id)
);

alter table public.products add column if not exists stock_alert_threshold numeric(12,2) check (stock_alert_threshold is null or stock_alert_threshold >= 0);

create index if not exists app_notifications_site_created_idx on public.app_notifications(site, created_at desc);
create index if not exists app_notifications_site_type_idx on public.app_notifications(site, type, severity, created_at desc);
create unique index if not exists app_notifications_site_dedupe_idx on public.app_notifications(site, dedupe_key);
create index if not exists app_notification_reads_admin_idx on public.app_notification_reads(admin_user_id, read_at, archived_at);
create index if not exists web_push_subscriptions_site_context_idx on public.web_push_subscriptions(site, context, enabled);
create unique index if not exists web_push_subscriptions_endpoint_hash_idx on public.web_push_subscriptions(site, endpoint_hash);
create index if not exists order_push_subscriptions_order_idx on public.order_push_subscriptions(order_id);
create index if not exists products_stock_alert_threshold_idx on public.products(stock_alert_threshold) where stock_alert_threshold is not null;

alter table public.app_notifications enable row level security;
alter table public.app_notification_reads enable row level security;
alter table public.web_push_subscriptions enable row level security;
alter table public.order_push_subscriptions enable row level security;

revoke all on public.app_notifications from anon;
revoke all on public.app_notification_reads from anon;
revoke all on public.web_push_subscriptions from anon, authenticated;
revoke all on public.order_push_subscriptions from anon, authenticated;
revoke all on public.app_notifications from authenticated;
grant select, insert, update on public.app_notification_reads to authenticated;

drop policy if exists "authenticated admins read operational notifications" on public.app_notifications;
drop policy if exists "admins manage their notification reads" on public.app_notification_reads;
create policy "admins manage their notification reads" on public.app_notification_reads for all to authenticated using (admin_user_id = auth.uid()) with check (admin_user_id = auth.uid());
