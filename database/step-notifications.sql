alter table public.orders
  add column if not exists admin_email_notified_at timestamptz,
  add column if not exists admin_whatsapp_notified_at timestamptz,
  add column if not exists customer_email_notified_at timestamptz;

create table if not exists public.order_status_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  channel text not null check (channel in ('customer_email', 'customer_whatsapp')),
  recipient text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_status_notifications_unique'
      and conrelid = 'public.order_status_notifications'::regclass
  ) then
    alter table public.order_status_notifications
      add constraint order_status_notifications_unique
      unique (order_id, status, channel, recipient);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_status_notifications_channel_check'
      and conrelid = 'public.order_status_notifications'::regclass
  ) then
    alter table public.order_status_notifications
      add constraint order_status_notifications_channel_check
      check (channel in ('customer_email', 'customer_whatsapp'));
  end if;
end $$;

create index if not exists order_status_notifications_order_idx
  on public.order_status_notifications(order_id, status);

alter table public.order_status_notifications enable row level security;