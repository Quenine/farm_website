-- Shields Farms server-managed contact inquiry audit.
begin;
create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text not null,
  inquiry_type text not null check (inquiry_type in ('product_availability','order_support','bulk_business_supply','delivery_question','partnership','other')),
  message text not null,
  source_path text not null default '/contact',
  status text not null default 'new' check (status in ('new','in_progress','resolved','spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  admin_notified_at timestamptz,
  customer_acknowledged_at timestamptz
);
create index if not exists contact_inquiries_status_idx on public.contact_inquiries(status);
create index if not exists contact_inquiries_created_at_idx on public.contact_inquiries(created_at desc);
alter table public.contact_inquiries enable row level security;
revoke all on public.contact_inquiries from anon, authenticated;
comment on table public.contact_inquiries is 'Server-only sales and support inquiry audit. No anonymous direct access.';
commit;
