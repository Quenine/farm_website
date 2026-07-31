create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'product_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.product_status as enum ('active', 'inactive', 'coming_soon');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'payment_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'order_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.order_status as enum (
      'pending_payment',
      'pending_delivery_quote',
      'paid',
      'processing',
      'packed',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'payment_review',
      'refunded'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'inventory_movement_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.inventory_movement_type as enum (
      'stock_in',
      'stock_out',
      'order_reserved',
      'order_cancelled',
      'manual_adjustment'
    );
  end if;
end $$;

alter type public.order_status add value if not exists 'pending_delivery_quote' after 'pending_payment';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category_id uuid not null references public.categories(id) on delete restrict,
  price numeric(12, 2) not null check (price >= 0),
  unit text not null check (char_length(trim(unit)) > 0),
  stock_quantity numeric(12, 2) not null default 0 check (stock_quantity >= 0),
  minimum_order_quantity numeric(12, 2) not null default 1 check (minimum_order_quantity > 0),
  quantity_step numeric(12, 2) not null default 1,
  quantity_input_type text not null default 'whole' check (quantity_input_type in ('whole', 'decimal')),
  pricing_mode text not null default 'fixed' check (pricing_mode in ('fixed', 'quote_required')),
  is_orderable_online boolean not null default true,
  display_price_label text,
  delivery_class text not null default 'standard',
  delivery_unit_value numeric(12, 2) not null default 1,
  handling_fee numeric(12, 2) not null default 0,
  supports_home_delivery boolean not null default true,
  supports_pickup_point boolean not null default true,
  supports_farm_pickup boolean not null default true,
  requires_delivery_confirmation boolean not null default false,
  status public.product_status not null default 'active',
  available_from date,
  is_featured boolean not null default false,
  featured_sort_order integer not null default 100,
  supports_wider_delivery boolean not null default false,
  is_live_animal boolean not null default false,
  is_processed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_coming_soon_date_check check (
    status <> 'coming_soon' or available_from is not null
  ),
  constraint products_quote_orderable_check check (
    pricing_mode = 'fixed' or is_orderable_online = false
  )
);

alter table public.products
  add column if not exists quantity_step numeric(12, 2) not null default 1,
  add column if not exists quantity_input_type text not null default 'whole',
  add column if not exists pricing_mode text not null default 'fixed',
  add column if not exists is_orderable_online boolean not null default true,
  add column if not exists display_price_label text,
  add column if not exists delivery_class text not null default 'standard',
  add column if not exists delivery_unit_value numeric(12, 2) not null default 1,
  add column if not exists handling_fee numeric(12, 2) not null default 0,
  add column if not exists supports_home_delivery boolean not null default true,
  add column if not exists supports_pickup_point boolean not null default true,
  add column if not exists supports_farm_pickup boolean not null default true,
  add column if not exists requires_delivery_confirmation boolean not null default false,
  add column if not exists featured_sort_order integer not null default 100,
  add column if not exists supports_wider_delivery boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_pricing_mode_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_pricing_mode_check
      check (pricing_mode in ('fixed', 'quote_required'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_quantity_step_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_quantity_step_check
      check (quantity_step > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_quantity_input_type_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_quantity_input_type_check
      check (quantity_input_type in ('whole', 'decimal'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_delivery_class_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_delivery_class_check
      check (delivery_class in (
        'standard', 'fragile', 'perishable', 'fragile_produce',
        'heavy_produce', 'live_animal', 'fresh_food', 'bulky_farm_input'
      ));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_quote_orderable_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_quote_orderable_check
      check (pricing_mode = 'fixed' or is_orderable_online = false);
  end if;
end $$;
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  url text not null,
  storage_path text,
  alt_text text,
  caption text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.product_delivery_rates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  state text not null,
  city text not null,
  delivery_method text not null check (delivery_method in ('home_delivery', 'pickup_point', 'farm_pickup')),
  package_size numeric(12, 2) not null default 1 check (package_size > 0),
  first_package_fee numeric(12, 2) not null default 0 check (first_package_fee >= 0),
  extra_package_fee numeric(12, 2) not null default 0 check (extra_package_fee >= 0),
  estimated_delivery_time text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_delivery_rates_unique unique (product_id, state, city, delivery_method),
  constraint product_delivery_rates_method_check check (delivery_method in ('home_delivery', 'pickup_point', 'farm_pickup'))
);
create table if not exists public.delivery_rates (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  city text not null,
  delivery_method text not null check (delivery_method in ('home_delivery', 'pickup_point', 'farm_pickup')),
  base_fee numeric(12, 2) not null default 0 check (base_fee >= 0),
  base_delivery_units numeric(12, 2) not null default 1 check (base_delivery_units >= 0),
  extra_fee_per_unit numeric(12, 2) not null default 0 check (extra_fee_per_unit >= 0),
  estimated_delivery_time text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  distance_km numeric(8, 2) not null check (distance_km >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery_address text not null,
  delivery_zone_id uuid references public.delivery_zones(id) on delete restrict,
  delivery_date date not null,
  delivery_note text,
  delivery_method text not null default 'home_delivery' check (delivery_method in ('home_delivery', 'pickup_point', 'farm_pickup')),
  delivery_state text,
  delivery_city text,
  delivery_rate_id uuid references public.delivery_rates(id) on delete set null,
  delivery_units numeric(12, 2) not null default 0,
  handling_fee numeric(12, 2) not null default 0,
  delivery_quote_required boolean not null default false,
  delivery_fee_confirmed boolean not null default true,
  delivery_pricing_model text not null default 'product_rate',
  delivery_rate_breakdown jsonb,
  delivery_package_count numeric(12, 2) not null default 0,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  payment_status public.payment_status not null default 'pending',
  order_status public.order_status not null default 'pending_payment',
  paystack_reference text unique,
  admin_email_notified_at timestamptz,
  admin_whatsapp_notified_at timestamptz,
  customer_email_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_check check (total_amount = subtotal + delivery_fee)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total_price numeric(12, 2) not null check (total_price >= 0),
  created_at timestamptz not null default now(),
  constraint order_items_total_check check (total_price = quantity * unit_price)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  reference text not null unique,
  amount numeric(12, 2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  channel text not null check (channel in ('customer_email', 'customer_whatsapp')),
  recipient text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  movement_type public.inventory_movement_type not null,
  quantity numeric(12, 2) not null check (quantity <> 0),
  previous_quantity numeric(12, 2) not null check (previous_quantity >= 0),
  new_quantity numeric(12, 2) not null check (new_quantity >= 0),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text not null,
  inquiry_type text not null check (inquiry_type in ('product_availability','order_support','bulk_business_supply','export_supply','delivery_question','partnership','other')),
  message text not null,
  company_name text,
  inquiry_details jsonb,
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

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.order_items
  add column if not exists order_id uuid references public.orders(id) on delete cascade,
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists product_name text,
  add column if not exists quantity numeric(12, 2) not null default 1,
  add column if not exists unit text not null default 'unit',
  add column if not exists unit_price numeric(12, 2) not null default 0,
  add column if not exists total_price numeric(12, 2) not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.payments
  add column if not exists order_id uuid references public.orders(id) on delete cascade,
  add column if not exists provider text not null default 'paystack',
  add column if not exists reference text,
  add column if not exists amount numeric(12, 2) not null default 0,
  add column if not exists status public.payment_status not null default 'pending',
  add column if not exists paid_at timestamptz,
  add column if not exists raw_response jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table public.order_status_notifications
  add column if not exists order_id uuid references public.orders(id) on delete cascade,
  add column if not exists status text,
  add column if not exists channel text,
  add column if not exists recipient text,
  add column if not exists sent_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.inventory_movements
  add column if not exists product_id uuid references public.products(id) on delete cascade,
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists order_item_id uuid references public.order_items(id) on delete set null,
  add column if not exists movement_type public.inventory_movement_type not null default 'manual_adjustment',
  add column if not exists quantity numeric(12, 2) not null default 1,
  add column if not exists previous_quantity numeric(12, 2) not null default 0,
  add column if not exists new_quantity numeric(12, 2) not null default 0,
  add column if not exists reason text,
  add column if not exists created_at timestamptz not null default now();

alter table public.orders
  alter column delivery_zone_id drop not null,
  add column if not exists payment_status public.payment_status not null default 'pending',
  add column if not exists order_status public.order_status not null default 'pending_payment',
  add column if not exists paystack_reference text,
  add column if not exists admin_email_notified_at timestamptz,
  add column if not exists admin_whatsapp_notified_at timestamptz,
  add column if not exists customer_email_notified_at timestamptz,
  add column if not exists delivery_method text not null default 'home_delivery',
  add column if not exists delivery_state text,
  add column if not exists delivery_city text,
  add column if not exists delivery_rate_id uuid references public.delivery_rates(id) on delete set null,
  add column if not exists delivery_units numeric(12, 2) not null default 0,
  add column if not exists handling_fee numeric(12, 2) not null default 0,
  add column if not exists delivery_quote_required boolean not null default false,
  add column if not exists delivery_fee_confirmed boolean not null default true,
  add column if not exists delivery_pricing_model text not null default 'product_rate',
  add column if not exists delivery_rate_breakdown jsonb,
  add column if not exists delivery_package_count numeric(12, 2) not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
alter table public.orders drop constraint if exists orders_delivery_method_check;

update public.orders
set delivery_method = case delivery_method
  when 'local_delivery' then 'home_delivery'
  when 'pickup' then 'farm_pickup'
  when 'wider_delivery' then 'home_delivery'
  else delivery_method
end
where delivery_method in ('local_delivery', 'pickup', 'wider_delivery');

alter table public.orders alter column delivery_method set default 'home_delivery';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_delivery_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_delivery_method_check
      check (delivery_method in ('home_delivery', 'pickup_point', 'farm_pickup'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_delivery_rates_unique'
      and conrelid = 'public.product_delivery_rates'::regclass
  ) then
    alter table public.product_delivery_rates
      add constraint product_delivery_rates_unique
      unique (product_id, state, city, delivery_method);
  end if;

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
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_status_idx on public.products(status);
create index if not exists products_featured_idx on public.products(is_featured, featured_sort_order) where is_featured = true;
create index if not exists product_images_product_id_sort_idx on public.product_images(product_id, sort_order);
create index if not exists product_media_product_id_sort_idx on public.product_media(product_id, sort_order);
create unique index if not exists product_media_one_primary_image_uidx
  on public.product_media(product_id)
  where is_primary = true and media_type = 'image';
create unique index if not exists product_delivery_rates_product_location_method_uidx
  on public.product_delivery_rates(product_id, lower(state), lower(city), delivery_method);
create index if not exists product_delivery_rates_active_lookup_idx
  on public.product_delivery_rates(product_id, is_active, lower(state), lower(city), delivery_method, sort_order);
create unique index if not exists delivery_rates_state_city_method_uidx
  on public.delivery_rates(lower(state), lower(city), delivery_method);
create index if not exists delivery_rates_active_lookup_idx
  on public.delivery_rates(is_active, lower(state), lower(city), delivery_method, sort_order);
create index if not exists delivery_zones_active_idx on public.delivery_zones(is_active);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists orders_order_status_idx on public.orders(order_status);
create index if not exists orders_delivery_zone_id_idx on public.orders(delivery_zone_id);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists order_status_notifications_order_idx on public.order_status_notifications(order_id, status);
create index if not exists inventory_movements_product_created_idx
  on public.inventory_movements(product_id, created_at desc);
create index if not exists inventory_movements_order_created_idx
  on public.inventory_movements(order_id, created_at desc);
create unique index if not exists inventory_movements_paid_order_item_uidx
  on public.inventory_movements(order_item_id)
  where order_item_id is not null
    and movement_type = 'stock_out';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists product_media_set_updated_at on public.product_media;

create trigger product_media_set_updated_at
before update on public.product_media
for each row execute function public.set_updated_at();

drop trigger if exists product_delivery_rates_set_updated_at on public.product_delivery_rates;

create trigger product_delivery_rates_set_updated_at
before update on public.product_delivery_rates
for each row execute function public.set_updated_at();

drop trigger if exists delivery_rates_set_updated_at on public.delivery_rates;

create trigger delivery_rates_set_updated_at
before update on public.delivery_rates
for each row execute function public.set_updated_at();

drop trigger if exists delivery_zones_set_updated_at on public.delivery_zones;

create trigger delivery_zones_set_updated_at
before update on public.delivery_zones
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_media enable row level security;
alter table public.product_delivery_rates enable row level security;
alter table public.delivery_rates enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_notifications enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Public can read categories" on public.categories;

create policy "Public can read categories"
on public.categories for select
to anon, authenticated
using (true);

drop policy if exists "Public can read available products" on public.products;

create policy "Public can read available products"
on public.products for select
to anon, authenticated
using (status in ('active', 'coming_soon'));

drop policy if exists "Public can read images for available products" on public.product_images;

create policy "Public can read images for available products"
on public.product_images for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = product_images.product_id
      and products.status in ('active', 'coming_soon')
  )
);

drop policy if exists "Public can read media for available products" on public.product_media;

create policy "Public can read media for available products"
on public.product_media for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = product_media.product_id
      and products.status in ('active', 'coming_soon')
  )
);


drop policy if exists "Public can read active product delivery rates" on public.product_delivery_rates;

create policy "Public can read active product delivery rates"
on public.product_delivery_rates for select
to anon, authenticated
using (is_active = true);
drop policy if exists "Public can read active delivery rates" on public.delivery_rates;

create policy "Public can read active delivery rates"
on public.delivery_rates for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Public can read active delivery zones" on public.delivery_zones;

create policy "Public can read active delivery zones"
on public.delivery_zones for select
to anon, authenticated
using (is_active = true);

-- Public clients receive no direct order read/write policies. Checkout,
-- tracking, and administration use narrow server-side operations that validate
-- inputs and recalculate prices and delivery fees before using trusted access.

create or replace function public.process_paystack_payment(
  p_order_id uuid,
  p_reference text,
  p_amount numeric,
  p_paid_at timestamptz,
  p_raw_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_insufficient boolean := false;
  v_expected_movements integer := 0;
  v_movement_count integer := 0;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.paystack_reference is distinct from p_reference
    and not exists (
      select 1
      from public.payments
      where reference = p_reference
        and order_id = p_order_id
    ) then
    raise exception 'Paystack reference does not belong to this order';
  end if;

  if v_order.total_amount <> p_amount then
    raise exception 'Payment amount does not match order total';
  end if;

  if exists (
    select 1
    from public.payments
    where reference = p_reference
      and order_id <> p_order_id
  ) then
    raise exception 'Paystack reference is linked to another order';
  end if;

  select count(*)
  into v_expected_movements
  from public.order_items
  where order_id = p_order_id
    and product_id is not null;

  select count(*)
  into v_movement_count
  from public.inventory_movements
  where order_id = p_order_id
    and movement_type = 'stock_out';

  if exists (
    select 1
    from public.payments
    where reference = p_reference
      and status = 'paid'
  ) then
    return jsonb_build_object(
      'processed', false,
      'already_processed', true,
      'needs_review', v_order.order_status = 'payment_review',
      'inventory_deducted',
        v_expected_movements > 0
        and v_movement_count = v_expected_movements,
      'movement_count', v_movement_count
    );
  end if;

  if v_order.payment_status = 'paid' then
    return jsonb_build_object(
      'processed', false,
      'already_processed', true,
      'needs_review', v_order.order_status = 'payment_review',
      'inventory_deducted',
        v_expected_movements > 0
        and v_movement_count = v_expected_movements,
      'movement_count', v_movement_count
    );
  end if;

  if v_movement_count > 0 then
    raise exception 'Inventory movements already exist for unpaid order';
  end if;

  for v_item in
    select
      oi.id as order_item_id,
      oi.product_id,
      oi.product_name,
      oi.quantity,
      p.stock_quantity
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
    order by oi.product_id
    for update of p
  loop
    if v_item.stock_quantity < v_item.quantity then
      v_insufficient := true;
    end if;
  end loop;

  insert into public.payments (
    order_id, provider, reference, amount, status, paid_at, raw_response
  )
  values (
    p_order_id, 'paystack', p_reference, p_amount, 'paid', p_paid_at,
    p_raw_response
  )
  on conflict (reference) do update
  set amount = excluded.amount,
      status = 'paid',
      paid_at = excluded.paid_at,
      raw_response = excluded.raw_response
  where public.payments.order_id = excluded.order_id;

  if v_insufficient then
    update public.orders
    set payment_status = 'paid',
        order_status = 'payment_review'
    where id = p_order_id;

    return jsonb_build_object(
      'processed', true,
      'already_processed', false,
      'needs_review', true,
      'inventory_deducted', false,
      'movement_count', 0
    );
  end if;

  for v_item in
    select
      oi.id as order_item_id,
      oi.product_id,
      oi.product_name,
      oi.quantity,
      p.stock_quantity
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
    order by oi.product_id
    for update of p
  loop
    update public.products
    set stock_quantity = v_item.stock_quantity - v_item.quantity
    where id = v_item.product_id;

    insert into public.inventory_movements (
      product_id,
      order_id,
      order_item_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      reason
    )
    values (
      v_item.product_id,
      p_order_id,
      v_item.order_item_id,
      'stock_out',
      v_item.quantity,
      v_item.stock_quantity,
      v_item.stock_quantity - v_item.quantity,
      'Payment confirmed for order ' || v_order.order_reference
    );
  end loop;

  update public.orders
  set payment_status = 'paid',
      order_status = 'processing'
  where id = p_order_id;

  return jsonb_build_object(
    'processed', true,
    'already_processed', false,
    'needs_review', false,
    'inventory_deducted', true,
    'movement_count', v_expected_movements
  );
end;
$$;

revoke all on function public.process_paystack_payment(
  uuid, text, numeric, timestamptz, jsonb
) from public;
grant execute on function public.process_paystack_payment(
  uuid, text, numeric, timestamptz, jsonb
) to service_role;









-- Reconciled Sales Scout foundation (20260729000100).
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
  ('Lagos Food Businesses â€” Launch Campaign','sales-scout-lagos-food-businesses-launch',
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


begin;

create unique index if not exists marketing_prospects_scout_provider_identity_uidx
  on public.marketing_prospects(discovery_source, discovery_source_id)
  where scout_status is not null
    and discovery_source is not null
    and discovery_source_id is not null;

create or replace function public.capture_sales_scout_candidate(
  p_payload jsonb,
  p_resolution text,
  p_existing_prospect_id uuid default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign_id uuid;
  v_prospect_id uuid;
  v_exact_ids uuid[];
  v_channel jsonb;
  v_inserted integer := 0;
  v_is_primary boolean;
  v_has_primary boolean := false;
  v_activity_id uuid;
  v_score integer;
  v_scored_at timestamptz;
begin
  if p_actor_id is null then
    raise exception using errcode = '22023', message = 'actor id is required for candidate capture';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'candidate payload must be an object';
  end if;
  if p_resolution not in ('create_new', 'attach_to_existing') then
    raise exception using errcode = '22023', message = 'invalid candidate resolution';
  end if;
  if p_resolution = 'attach_to_existing' and p_existing_prospect_id is null then
    raise exception using errcode = '22023', message = 'existing prospect id is required for attachment';
  end if;
  if nullif(trim(p_payload->>'businessName'), '') is null
    or nullif(trim(p_payload->>'businessCategory'), '') is null
    or nullif(trim(p_payload->>'city'), '') is null
    or nullif(trim(p_payload->>'country'), '') is null
    or nullif(trim(p_payload->>'provider'), '') is null
    or nullif(trim(p_payload->>'sourceUrl'), '') is null
    or jsonb_typeof(p_payload->'channels') is distinct from 'array'
    or jsonb_array_length(p_payload->'channels') = 0
    or jsonb_typeof(p_payload->'score') is distinct from 'object' then
    raise exception using errcode = '22023', message = 'candidate payload is incomplete';
  end if;

  if jsonb_typeof(p_payload->'score'->'score') is distinct from 'number'
    or (p_payload->'score'->>'score') !~ '^\d+$'
    or (p_payload->'score'->>'score')::numeric not between 0 and 100
    or p_payload->'score'->>'ruleVersion' <> 'ng-city-b2b-v1'
    or jsonb_typeof(p_payload->'score'->'factors') is distinct from 'array'
    or nullif(p_payload->'score'->>'scoredAt', '') is null then
    raise exception using errcode = '22023', message = 'candidate score payload is invalid';
  end if;
  begin
    v_score := (p_payload->'score'->>'score')::integer;
    v_scored_at := (p_payload->'score'->>'scoredAt')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'candidate score payload is invalid';
  end;

  begin
    v_campaign_id := (p_payload->>'campaignId')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'candidate campaign id is invalid';
  end;

  perform 1
  from public.marketing_sales_scout_campaigns
  where campaign_id = v_campaign_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Sales Scout campaign not found';
  end if;

  select coalesce(array_agg(distinct match_id), '{}'::uuid[])
  into v_exact_ids
  from (
    select c.prospect_id as match_id
    from public.marketing_prospect_channels c
    join jsonb_array_elements(p_payload->'channels') candidate
      on c.platform = candidate->>'platform'
      and c.identity_key = candidate->>'identityKey'
    where c.is_active
    union
    select c.prospect_id
    from public.marketing_prospect_channels c
    join jsonb_array_elements(p_payload->'channels') candidate
      on c.source = p_payload->>'provider'
      and c.source_id = candidate->>'sourceId'
    where nullif(candidate->>'sourceId', '') is not null
    union
    select p.id
    from public.marketing_prospects p
    where nullif(p_payload->>'providerSourceId', '') is not null
      and p.discovery_source = p_payload->>'provider'
      and p.discovery_source_id = p_payload->>'providerSourceId'
  ) matches;

  if cardinality(v_exact_ids) > 1 then
    raise exception using errcode = '23000', message = 'candidate identities match multiple prospects';
  end if;
  if cardinality(v_exact_ids) = 1 then
    return jsonb_build_object(
      'outcome', 'exact_existing',
      'prospect_id', v_exact_ids[1],
      'channels_inserted', 0,
      'exact_duplicate_reason', 'existing exact identity',
      'activity_id', null
    );
  end if;

  if p_resolution = 'attach_to_existing' then
    select id into v_prospect_id
    from public.marketing_prospects
    where id = p_existing_prospect_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'prospect not found';
    end if;
    select exists (
      select 1 from public.marketing_prospect_channels
      where prospect_id = v_prospect_id and is_active and is_primary
    ) into v_has_primary;
  else
    insert into public.marketing_prospects (
      business_name, business_category, stage, source, campaign_id, scout_status,
      city, state, country, location_evidence, service_area_cities,
      discovery_source, discovery_source_id, source_url, discovered_at,
      profile_last_activity_at, has_recurring_produce_demand,
      recurring_demand_evidence, demand_band, appears_inactive_or_closed,
      is_consumer_only, score, score_version, score_factors, scored_at, created_by
    ) values (
      trim(p_payload->>'businessName'), trim(p_payload->>'businessCategory'),
      'identified', 'sales_scout', v_campaign_id, 'new',
      trim(p_payload->>'city'), nullif(trim(p_payload->>'state'), ''),
      trim(p_payload->>'country'),
      jsonb_build_object('source_url', p_payload->>'sourceUrl', 'observed_at', p_payload->>'observedAt'),
      coalesce(array(select jsonb_array_elements_text(p_payload->'serviceAreaCities')), '{}'::text[]),
      trim(p_payload->>'provider'), nullif(trim(p_payload->>'providerSourceId'), ''),
      p_payload->>'sourceUrl', (p_payload->>'observedAt')::timestamptz,
      nullif(p_payload->>'mostRecentPublicActivityAt', '')::timestamptz,
      nullif(p_payload->>'recurringProduceDemandEvidence', '') is not null,
      nullif(trim(p_payload->>'recurringProduceDemandEvidence'), ''),
      p_payload->>'demandBand', (p_payload->>'isInactiveOrClosed')::boolean,
      (p_payload->>'isConsumerOnly')::boolean, v_score,
      p_payload->'score'->>'ruleVersion', p_payload->'score'->'factors',
      v_scored_at, p_actor_id
    )
    returning id into v_prospect_id;
  end if;

  for v_channel in select value from jsonb_array_elements(p_payload->'channels')
  loop
    v_is_primary := (v_channel->>'isPrimary')::boolean and not v_has_primary;
    insert into public.marketing_prospect_channels (
      prospect_id, platform, handle_or_value, identity_key, profile_url,
      is_primary, source, source_id, evidence, created_by
    ) values (
      v_prospect_id, v_channel->>'platform', v_channel->>'handleOrValue',
      v_channel->>'identityKey', nullif(v_channel->>'profileUrl', ''),
      v_is_primary, p_payload->>'provider', nullif(v_channel->>'sourceId', ''),
      coalesce(v_channel->'evidence', '{}'::jsonb), p_actor_id
    );
    v_inserted := v_inserted + 1;
    v_has_primary := v_has_primary or v_is_primary;
  end loop;

  if p_resolution = 'create_new' and v_inserted = 0 then
    raise exception using errcode = '23000', message = 'new candidate requires at least one inserted channel';
  end if;

  insert into public.marketing_prospect_activities (
    prospect_id, activity_type, summary, occurred_at, created_by, metadata
  ) values (
    v_prospect_id, 'sales_scout',
    case when p_resolution = 'create_new'
      then 'Sales Scout candidate captured.'
      else 'Sales Scout candidate attached to existing prospect.'
    end,
    (p_payload->>'observedAt')::timestamptz, p_actor_id,
    jsonb_build_object(
      'event', case when p_resolution = 'create_new' then 'scout_captured' else 'candidate_attached' end,
      'provider', p_payload->>'provider',
      'source_url', p_payload->>'sourceUrl',
      'channels_inserted', v_inserted
    )
  )
  returning id into v_activity_id;

  return jsonb_build_object(
    'outcome', case when p_resolution = 'create_new' then 'created' else 'attached' end,
    'prospect_id', v_prospect_id,
    'channels_inserted', v_inserted,
    'exact_duplicate_reason', null,
    'activity_id', v_activity_id
  );
exception
  when unique_violation then
    select coalesce(array_agg(distinct match_id), '{}'::uuid[])
    into v_exact_ids
    from (
      select c.prospect_id as match_id
      from public.marketing_prospect_channels c
      join jsonb_array_elements(p_payload->'channels') candidate
        on c.platform = candidate->>'platform'
        and c.identity_key = candidate->>'identityKey'
      where c.is_active
      union
      select c.prospect_id
      from public.marketing_prospect_channels c
      join jsonb_array_elements(p_payload->'channels') candidate
        on c.source = p_payload->>'provider'
        and c.source_id = candidate->>'sourceId'
      where nullif(candidate->>'sourceId', '') is not null
      union
      select p.id
      from public.marketing_prospects p
      where nullif(p_payload->>'providerSourceId', '') is not null
        and p.discovery_source = p_payload->>'provider'
        and p.discovery_source_id = p_payload->>'providerSourceId'
    ) matches;
    if cardinality(v_exact_ids) > 1 then
      raise exception using errcode = '23000', message = 'candidate identities match multiple prospects';
    end if;
    if cardinality(v_exact_ids) = 1 then
      return jsonb_build_object(
        'outcome', 'exact_existing',
        'prospect_id', v_exact_ids[1],
        'channels_inserted', 0,
        'exact_duplicate_reason', 'concurrent exact identity capture',
        'activity_id', null
      );
    end if;
    raise exception using errcode = '40001', message = 'candidate capture conflicted concurrently';
end;
$$;

create or replace function public.update_sales_scout_qualification_facts(
  p_payload jsonb,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prospect public.marketing_prospects%rowtype;
  v_prospect_id uuid;
  v_campaign_id uuid;
  v_score integer;
  v_scored_at timestamptz;
  v_activity_at timestamptz;
  v_activity_id uuid;
begin
  if p_actor_id is null then
    raise exception using errcode = '22023', message = 'actor id is required for qualification update';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'qualification payload must be an object';
  end if;
  begin
    v_prospect_id := (p_payload->>'prospectId')::uuid;
    v_campaign_id := (p_payload->>'campaignId')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'qualification prospect and campaign ids are invalid';
  end;
  if v_prospect_id is null or v_campaign_id is null then
    raise exception using errcode = '22023', message = 'qualification prospect and campaign ids are invalid';
  end if;
  if nullif(trim(p_payload->>'businessCategory'), '') is null
    or nullif(trim(p_payload->>'city'), '') is null
    or nullif(trim(p_payload->>'country'), '') is null
    or nullif(trim(p_payload->>'sourceUrl'), '') is null
    or jsonb_typeof(p_payload->'serviceAreaCities') is distinct from 'array'
    or jsonb_typeof(p_payload->'locationEvidence') is distinct from 'object'
    or p_payload->>'demandBand' not in ('high','medium','low','unknown')
    or jsonb_typeof(p_payload->'isInactiveOrClosed') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'isConsumerOnly') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'score') is distinct from 'object' then
    raise exception using errcode = '22023', message = 'qualification payload is incomplete';
  end if;
  if jsonb_typeof(p_payload->'score'->'score') is distinct from 'number'
    or (p_payload->'score'->>'score') !~ '^\d+$'
    or (p_payload->'score'->>'score')::numeric not between 0 and 100
    or p_payload->'score'->>'ruleVersion' <> 'ng-city-b2b-v1'
    or jsonb_typeof(p_payload->'score'->'factors') is distinct from 'array'
    or nullif(p_payload->'score'->>'scoredAt', '') is null then
    raise exception using errcode = '22023', message = 'qualification score payload is invalid';
  end if;
  begin
    v_score := (p_payload->'score'->>'score')::integer;
    v_scored_at := (p_payload->'score'->>'scoredAt')::timestamptz;
    v_activity_at := nullif(p_payload->>'mostRecentPublicActivityAt', '')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'qualification timestamps are invalid';
  end;

  select * into v_prospect
  from public.marketing_prospects
  where id = v_prospect_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'prospect not found';
  end if;
  if v_prospect.scout_status is null then
    raise exception using errcode = '22023', message = 'prospect is not a Sales Scout prospect';
  end if;
  if v_prospect.campaign_id is distinct from v_campaign_id then
    raise exception using errcode = '22023', message = 'prospect campaign does not match qualification campaign';
  end if;
  perform 1 from public.marketing_sales_scout_campaigns
  where campaign_id = v_campaign_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Sales Scout campaign not found';
  end if;

  update public.marketing_prospects set
    business_category = trim(p_payload->>'businessCategory'),
    city = trim(p_payload->>'city'),
    state = nullif(trim(p_payload->>'state'), ''),
    country = trim(p_payload->>'country'),
    service_area_cities = coalesce(
      array(select jsonb_array_elements_text(p_payload->'serviceAreaCities')),
      '{}'::text[]
    ),
    profile_last_activity_at = v_activity_at,
    has_recurring_produce_demand = nullif(trim(p_payload->>'recurringProduceDemandEvidence'), '') is not null,
    recurring_demand_evidence = nullif(trim(p_payload->>'recurringProduceDemandEvidence'), ''),
    demand_band = p_payload->>'demandBand',
    appears_inactive_or_closed = (p_payload->>'isInactiveOrClosed')::boolean,
    is_consumer_only = (p_payload->>'isConsumerOnly')::boolean,
    source_url = p_payload->>'sourceUrl',
    location_evidence = p_payload->'locationEvidence',
    score = v_score,
    score_version = p_payload->'score'->>'ruleVersion',
    score_factors = p_payload->'score'->'factors',
    scored_at = v_scored_at,
    updated_at = now()
  where id = v_prospect_id;

  insert into public.marketing_prospect_activities (
    prospect_id, activity_type, summary, occurred_at, created_by, metadata
  ) values (
    v_prospect_id, 'sales_scout', 'Sales Scout qualification facts and score updated.',
    v_scored_at, p_actor_id,
    jsonb_build_object(
      'event', 'scout_scored',
      'score', v_score,
      'score_version', p_payload->'score'->>'ruleVersion'
    )
  ) returning id into v_activity_id;

  return jsonb_build_object(
    'prospect_id', v_prospect_id,
    'score', v_score,
    'rule_version', p_payload->'score'->>'ruleVersion',
    'activity_id', v_activity_id
  );
end;
$$;

revoke all on function public.capture_sales_scout_candidate(jsonb,text,uuid,uuid) from public;
revoke all on function public.capture_sales_scout_candidate(jsonb,text,uuid,uuid) from anon;
revoke all on function public.capture_sales_scout_candidate(jsonb,text,uuid,uuid) from authenticated;
grant execute on function public.capture_sales_scout_candidate(jsonb,text,uuid,uuid) to service_role;

revoke all on function public.update_sales_scout_qualification_facts(jsonb,uuid) from public;
revoke all on function public.update_sales_scout_qualification_facts(jsonb,uuid) from anon;
revoke all on function public.update_sales_scout_qualification_facts(jsonb,uuid) from authenticated;
grant execute on function public.update_sales_scout_qualification_facts(jsonb,uuid) to service_role;

notify pgrst, 'reload schema';
commit;

begin;

alter table public.marketing_prospects add column if not exists scout_campaign_id uuid;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.marketing_prospects'::regclass and conname='marketing_prospects_scout_campaign_id_fkey') then
    alter table public.marketing_prospects add constraint marketing_prospects_scout_campaign_id_fkey
      foreign key(scout_campaign_id) references public.marketing_sales_scout_campaigns(campaign_id) on delete restrict;
  end if;
end $$;
create index if not exists marketing_prospects_scout_campaign_idx
  on public.marketing_prospects(scout_campaign_id,scout_status,created_at desc)
  where scout_campaign_id is not null and scout_status is not null;
update public.marketing_prospects prospect set scout_campaign_id=prospect.campaign_id
where prospect.scout_status is not null and prospect.scout_campaign_id is null
  and exists(select 1 from public.marketing_sales_scout_campaigns scout where scout.campaign_id=prospect.campaign_id);

create or replace function public.capture_sales_scout_candidate(
  p_payload jsonb,
  p_resolution text,
  p_existing_prospect_id uuid default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign_id uuid;
  v_prospect_id uuid;
  v_exact_ids uuid[];
  v_channel jsonb;
  v_inserted integer := 0;
  v_is_primary boolean;
  v_has_primary boolean := false;
  v_activity_id uuid;
  v_score integer;
  v_scored_at timestamptz;
  v_prospect public.marketing_prospects%rowtype;
  v_enrolled boolean := false;
begin
  if p_actor_id is null then
    raise exception using errcode = '22023', message = 'actor id is required for candidate capture';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'candidate payload must be an object';
  end if;
  if p_resolution not in ('create_new', 'attach_to_existing') then
    raise exception using errcode = '22023', message = 'invalid candidate resolution';
  end if;
  if p_resolution = 'attach_to_existing' and p_existing_prospect_id is null then
    raise exception using errcode = '22023', message = 'existing prospect id is required for attachment';
  end if;
  if nullif(trim(p_payload->>'businessName'), '') is null
    or nullif(trim(p_payload->>'businessCategory'), '') is null
    or nullif(trim(p_payload->>'city'), '') is null
    or nullif(trim(p_payload->>'country'), '') is null
    or nullif(trim(p_payload->>'provider'), '') is null
    or nullif(trim(p_payload->>'sourceUrl'), '') is null
    or jsonb_typeof(p_payload->'channels') is distinct from 'array'
    or jsonb_array_length(p_payload->'channels') = 0
    or jsonb_typeof(p_payload->'score') is distinct from 'object' then
    raise exception using errcode = '22023', message = 'candidate payload is incomplete';
  end if;

  if jsonb_typeof(p_payload->'score'->'score') is distinct from 'number'
    or (p_payload->'score'->>'score') !~ '^\d+$'
    or (p_payload->'score'->>'score')::numeric not between 0 and 100
    or p_payload->'score'->>'ruleVersion' <> 'ng-city-b2b-v1'
    or jsonb_typeof(p_payload->'score'->'factors') is distinct from 'array'
    or nullif(p_payload->'score'->>'scoredAt', '') is null then
    raise exception using errcode = '22023', message = 'candidate score payload is invalid';
  end if;
  begin
    v_score := (p_payload->'score'->>'score')::integer;
    v_scored_at := (p_payload->'score'->>'scoredAt')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'candidate score payload is invalid';
  end;

  begin
    v_campaign_id := (p_payload->>'campaignId')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'candidate campaign id is invalid';
  end;

  perform 1
  from public.marketing_sales_scout_campaigns
  where campaign_id = v_campaign_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Sales Scout campaign not found';
  end if;

  select coalesce(array_agg(distinct match_id), '{}'::uuid[])
  into v_exact_ids
  from (
    select c.prospect_id as match_id
    from public.marketing_prospect_channels c
    join jsonb_array_elements(p_payload->'channels') candidate
      on c.platform = candidate->>'platform'
      and c.identity_key = candidate->>'identityKey'
    where c.is_active
    union
    select c.prospect_id
    from public.marketing_prospect_channels c
    join jsonb_array_elements(p_payload->'channels') candidate
      on c.source = p_payload->>'provider'
      and c.source_id = candidate->>'sourceId'
    where nullif(candidate->>'sourceId', '') is not null
    union
    select p.id
    from public.marketing_prospects p
    where nullif(p_payload->>'providerSourceId', '') is not null
      and p.discovery_source = p_payload->>'provider'
      and p.discovery_source_id = p_payload->>'providerSourceId'
  ) matches;

  if cardinality(v_exact_ids) > 1 then
    raise exception using errcode = '23000', message = 'candidate identities match multiple prospects';
  end if;
  if cardinality(v_exact_ids) = 1 then
    if p_resolution = 'create_new' then
      return jsonb_build_object('outcome','exact_existing','prospect_id',v_exact_ids[1],
        'channels_inserted',0,'exact_duplicate_reason','existing exact identity',
        'activity_id',null,'existing_prospect_enrolled',false);
    end if;
    if p_existing_prospect_id is distinct from v_exact_ids[1] then
      raise exception using errcode='22023',message='selected attachment target does not own the exact identity';
    end if;
    v_prospect_id := v_exact_ids[1];
  end if;

  if p_resolution = 'attach_to_existing' then
    v_prospect_id := coalesce(v_prospect_id,p_existing_prospect_id);
    select * into v_prospect from public.marketing_prospects where id=v_prospect_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'prospect not found';
    end if;
    select exists (
      select 1 from public.marketing_prospect_channels
      where prospect_id = v_prospect_id and is_active and is_primary
    ) into v_has_primary;
    if v_prospect.scout_status is not null and v_prospect.scout_campaign_id is distinct from v_campaign_id then
      raise exception using errcode='22023',message='existing Scout prospect belongs to a different Scout campaign';
    end if;
    if v_prospect.scout_status is null then
      update public.marketing_prospects set
        scout_campaign_id=v_campaign_id,
        scout_status=case when do_not_contact_at is null then 'new' else 'do_not_contact' end,
        business_category=coalesce(business_category,trim(p_payload->>'businessCategory')),
        city=coalesce(city,trim(p_payload->>'city')),state=coalesce(state,nullif(trim(p_payload->>'state'),'')),
        country=coalesce(country,trim(p_payload->>'country')),
        service_area_cities=coalesce(service_area_cities,array(select jsonb_array_elements_text(p_payload->'serviceAreaCities'))),
        location_evidence=coalesce(location_evidence,jsonb_build_object('source_url',p_payload->>'sourceUrl','observed_at',p_payload->>'observedAt')),
        discovery_source=coalesce(discovery_source,trim(p_payload->>'provider')),
        discovery_source_id=coalesce(discovery_source_id,nullif(trim(p_payload->>'providerSourceId'),'')),
        source_url=coalesce(source_url,p_payload->>'sourceUrl'),discovered_at=coalesce(discovered_at,(p_payload->>'observedAt')::timestamptz),
        profile_last_activity_at=coalesce(profile_last_activity_at,nullif(p_payload->>'mostRecentPublicActivityAt','')::timestamptz),
        has_recurring_produce_demand=coalesce(has_recurring_produce_demand,nullif(p_payload->>'recurringProduceDemandEvidence','') is not null),
        recurring_demand_evidence=coalesce(recurring_demand_evidence,nullif(trim(p_payload->>'recurringProduceDemandEvidence'),'')),
        demand_band=coalesce(demand_band,p_payload->>'demandBand'),
        appears_inactive_or_closed=coalesce(appears_inactive_or_closed,(p_payload->>'isInactiveOrClosed')::boolean),
        is_consumer_only=coalesce(is_consumer_only,(p_payload->>'isConsumerOnly')::boolean),
        score=coalesce(score,v_score),score_version=coalesce(score_version,p_payload->'score'->>'ruleVersion'),
        score_factors=coalesce(score_factors,p_payload->'score'->'factors'),scored_at=coalesce(scored_at,v_scored_at),updated_at=now()
      where id=v_prospect_id;
      v_enrolled := true;
    end if;
  else
    insert into public.marketing_prospects (
      business_name, business_category, stage, source, campaign_id, scout_campaign_id, scout_status,
      city, state, country, location_evidence, service_area_cities,
      discovery_source, discovery_source_id, source_url, discovered_at,
      profile_last_activity_at, has_recurring_produce_demand,
      recurring_demand_evidence, demand_band, appears_inactive_or_closed,
      is_consumer_only, score, score_version, score_factors, scored_at, created_by
    ) values (
      trim(p_payload->>'businessName'), trim(p_payload->>'businessCategory'),
      'identified', 'sales_scout', v_campaign_id, v_campaign_id, 'new',
      trim(p_payload->>'city'), nullif(trim(p_payload->>'state'), ''),
      trim(p_payload->>'country'),
      jsonb_build_object('source_url', p_payload->>'sourceUrl', 'observed_at', p_payload->>'observedAt'),
      coalesce(array(select jsonb_array_elements_text(p_payload->'serviceAreaCities')), '{}'::text[]),
      trim(p_payload->>'provider'), nullif(trim(p_payload->>'providerSourceId'), ''),
      p_payload->>'sourceUrl', (p_payload->>'observedAt')::timestamptz,
      nullif(p_payload->>'mostRecentPublicActivityAt', '')::timestamptz,
      nullif(p_payload->>'recurringProduceDemandEvidence', '') is not null,
      nullif(trim(p_payload->>'recurringProduceDemandEvidence'), ''),
      p_payload->>'demandBand', (p_payload->>'isInactiveOrClosed')::boolean,
      (p_payload->>'isConsumerOnly')::boolean, v_score,
      p_payload->'score'->>'ruleVersion', p_payload->'score'->'factors',
      v_scored_at, p_actor_id
    )
    returning id into v_prospect_id;
  end if;

  for v_channel in select value from jsonb_array_elements(p_payload->'channels')
  loop
    if exists(select 1 from public.marketing_prospect_channels c where c.prospect_id=v_prospect_id
      and ((c.is_active and c.platform=v_channel->>'platform' and c.identity_key=v_channel->>'identityKey')
        or (nullif(v_channel->>'sourceId','') is not null and c.source=p_payload->>'provider' and c.source_id=v_channel->>'sourceId'))) then
      continue;
    end if;
    v_is_primary := (v_channel->>'isPrimary')::boolean and not v_has_primary;
    insert into public.marketing_prospect_channels (
      prospect_id, platform, handle_or_value, identity_key, profile_url,
      is_primary, source, source_id, evidence, created_by
    ) values (
      v_prospect_id, v_channel->>'platform', v_channel->>'handleOrValue',
      v_channel->>'identityKey', nullif(v_channel->>'profileUrl', ''),
      v_is_primary, p_payload->>'provider', nullif(v_channel->>'sourceId', ''),
      coalesce(v_channel->'evidence', '{}'::jsonb), p_actor_id
    );
    v_inserted := v_inserted + 1;
    v_has_primary := v_has_primary or v_is_primary;
  end loop;

  if p_resolution='attach_to_existing' and not v_enrolled and v_inserted=0 then
    return jsonb_build_object('outcome','exact_existing','prospect_id',v_prospect_id,
      'channels_inserted',0,'exact_duplicate_reason','candidate already fully attached',
      'activity_id',null,'existing_prospect_enrolled',false);
  end if;

  if p_resolution = 'create_new' and v_inserted = 0 then
    raise exception using errcode = '23000', message = 'new candidate requires at least one inserted channel';
  end if;

  insert into public.marketing_prospect_activities (
    prospect_id, activity_type, summary, occurred_at, created_by, metadata
  ) values (
    v_prospect_id, 'sales_scout',
    case when p_resolution = 'create_new'
      then 'Sales Scout candidate captured.'
      else 'Sales Scout candidate attached to existing prospect.'
    end,
    (p_payload->>'observedAt')::timestamptz, p_actor_id,
    jsonb_build_object(
      'event', case when p_resolution = 'create_new' then 'scout_captured' else 'candidate_attached' end,
      'provider', p_payload->>'provider',
      'source_url', p_payload->>'sourceUrl',
      'channels_inserted', v_inserted,
      'existing_prospect_enrolled',v_enrolled
    )
  )
  returning id into v_activity_id;

  return jsonb_build_object(
    'outcome', case when p_resolution = 'create_new' then 'created' else 'attached' end,
    'prospect_id', v_prospect_id,
    'channels_inserted', v_inserted,
    'exact_duplicate_reason', null,
    'activity_id', v_activity_id,
    'existing_prospect_enrolled',v_enrolled
  );
exception
  when unique_violation then
    select coalesce(array_agg(distinct match_id), '{}'::uuid[])
    into v_exact_ids
    from (
      select c.prospect_id as match_id
      from public.marketing_prospect_channels c
      join jsonb_array_elements(p_payload->'channels') candidate
        on c.platform = candidate->>'platform'
        and c.identity_key = candidate->>'identityKey'
      where c.is_active
      union
      select c.prospect_id
      from public.marketing_prospect_channels c
      join jsonb_array_elements(p_payload->'channels') candidate
        on c.source = p_payload->>'provider'
        and c.source_id = candidate->>'sourceId'
      where nullif(candidate->>'sourceId', '') is not null
      union
      select p.id
      from public.marketing_prospects p
      where nullif(p_payload->>'providerSourceId', '') is not null
        and p.discovery_source = p_payload->>'provider'
        and p.discovery_source_id = p_payload->>'providerSourceId'
    ) matches;
    if cardinality(v_exact_ids) > 1 then
      raise exception using errcode = '23000', message = 'candidate identities match multiple prospects';
    end if;
    if cardinality(v_exact_ids) = 1 then
      return jsonb_build_object(
        'outcome', 'exact_existing',
        'prospect_id', v_exact_ids[1],
        'channels_inserted', 0,
        'exact_duplicate_reason', 'concurrent exact identity capture',
        'activity_id', null,
        'existing_prospect_enrolled',false
      );
    end if;
    raise exception using errcode = '40001', message = 'candidate capture conflicted concurrently';
end;
$$;

create or replace function public.update_sales_scout_qualification_facts(
  p_payload jsonb,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prospect public.marketing_prospects%rowtype;
  v_prospect_id uuid;
  v_campaign_id uuid;
  v_score integer;
  v_scored_at timestamptz;
  v_activity_at timestamptz;
  v_activity_id uuid;
begin
  if p_actor_id is null then
    raise exception using errcode = '22023', message = 'actor id is required for qualification update';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'qualification payload must be an object';
  end if;
  begin
    v_prospect_id := (p_payload->>'prospectId')::uuid;
    v_campaign_id := (p_payload->>'campaignId')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'qualification prospect and campaign ids are invalid';
  end;
  if v_prospect_id is null or v_campaign_id is null then
    raise exception using errcode = '22023', message = 'qualification prospect and campaign ids are invalid';
  end if;
  if nullif(trim(p_payload->>'businessCategory'), '') is null
    or nullif(trim(p_payload->>'city'), '') is null
    or nullif(trim(p_payload->>'country'), '') is null
    or nullif(trim(p_payload->>'sourceUrl'), '') is null
    or jsonb_typeof(p_payload->'serviceAreaCities') is distinct from 'array'
    or jsonb_typeof(p_payload->'locationEvidence') is distinct from 'object'
    or p_payload->>'demandBand' not in ('high','medium','low','unknown')
    or jsonb_typeof(p_payload->'isInactiveOrClosed') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'isConsumerOnly') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'score') is distinct from 'object' then
    raise exception using errcode = '22023', message = 'qualification payload is incomplete';
  end if;
  if jsonb_typeof(p_payload->'score'->'score') is distinct from 'number'
    or (p_payload->'score'->>'score') !~ '^\d+$'
    or (p_payload->'score'->>'score')::numeric not between 0 and 100
    or p_payload->'score'->>'ruleVersion' <> 'ng-city-b2b-v1'
    or jsonb_typeof(p_payload->'score'->'factors') is distinct from 'array'
    or nullif(p_payload->'score'->>'scoredAt', '') is null then
    raise exception using errcode = '22023', message = 'qualification score payload is invalid';
  end if;
  begin
    v_score := (p_payload->'score'->>'score')::integer;
    v_scored_at := (p_payload->'score'->>'scoredAt')::timestamptz;
    v_activity_at := nullif(p_payload->>'mostRecentPublicActivityAt', '')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'qualification timestamps are invalid';
  end;

  select * into v_prospect
  from public.marketing_prospects
  where id = v_prospect_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'prospect not found';
  end if;
  if v_prospect.scout_status is null then
    raise exception using errcode = '22023', message = 'prospect is not a Sales Scout prospect';
  end if;
  if v_prospect.scout_campaign_id is distinct from v_campaign_id then
    raise exception using errcode = '22023', message = 'prospect campaign does not match qualification campaign';
  end if;
  perform 1 from public.marketing_sales_scout_campaigns
  where campaign_id = v_campaign_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Sales Scout campaign not found';
  end if;

  update public.marketing_prospects set
    business_category = trim(p_payload->>'businessCategory'),
    city = trim(p_payload->>'city'),
    state = nullif(trim(p_payload->>'state'), ''),
    country = trim(p_payload->>'country'),
    service_area_cities = coalesce(
      array(select jsonb_array_elements_text(p_payload->'serviceAreaCities')),
      '{}'::text[]
    ),
    profile_last_activity_at = v_activity_at,
    has_recurring_produce_demand = nullif(trim(p_payload->>'recurringProduceDemandEvidence'), '') is not null,
    recurring_demand_evidence = nullif(trim(p_payload->>'recurringProduceDemandEvidence'), ''),
    demand_band = p_payload->>'demandBand',
    appears_inactive_or_closed = (p_payload->>'isInactiveOrClosed')::boolean,
    is_consumer_only = (p_payload->>'isConsumerOnly')::boolean,
    source_url = p_payload->>'sourceUrl',
    location_evidence = p_payload->'locationEvidence',
    score = v_score,
    score_version = p_payload->'score'->>'ruleVersion',
    score_factors = p_payload->'score'->'factors',
    scored_at = v_scored_at,
    updated_at = now()
  where id = v_prospect_id;

  insert into public.marketing_prospect_activities (
    prospect_id, activity_type, summary, occurred_at, created_by, metadata
  ) values (
    v_prospect_id, 'sales_scout', 'Sales Scout qualification facts and score updated.',
    v_scored_at, p_actor_id,
    jsonb_build_object(
      'event', 'scout_scored',
      'score', v_score,
      'score_version', p_payload->'score'->>'ruleVersion'
    )
  ) returning id into v_activity_id;

  return jsonb_build_object(
    'prospect_id', v_prospect_id,
    'score', v_score,
    'rule_version', p_payload->'score'->>'ruleVersion',
    'activity_id', v_activity_id
  );
end;
$$;

create or replace function public.transition_sales_scout_review_status(
  p_payload jsonb,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prospect public.marketing_prospects%rowtype;
  v_prospect_id uuid;
  v_target text;
  v_reason text;
  v_activity_id uuid;
  v_campaign public.marketing_sales_scout_campaigns%rowtype;
begin
  if p_actor_id is null then
    raise exception using errcode='22023', message='actor id is required for Scout review transition';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode='22023', message='review transition payload must be an object';
  end if;
  begin
    v_prospect_id := (p_payload->>'prospectId')::uuid;
  exception when others then
    raise exception using errcode='22023', message='prospect id is invalid';
  end;
  v_target := p_payload->>'targetStatus';
  v_reason := nullif(trim(p_payload->>'reason'), '');
  if v_prospect_id is null or v_target not in ('new','researching','qualified','disqualified','closed') then
    raise exception using errcode='22023', message='review target status is invalid';
  end if;
  if v_target in ('disqualified','closed') and v_reason is null then
    raise exception using errcode='22023', message='reason is required for disqualified or closed status';
  end if;

  select * into v_prospect from public.marketing_prospects
  where id=v_prospect_id for update;
  if not found then raise exception using errcode='P0002', message='prospect not found'; end if;
  if v_prospect.scout_status is null then
    raise exception using errcode='22023', message='prospect is not a Sales Scout prospect';
  end if;
  if v_prospect.scout_status='do_not_contact' and v_target <> 'do_not_contact' then
    raise exception using errcode='22023', message='do-not-contact prospect cannot leave suppression';
  end if;
  if v_prospect.scout_status=v_target then
    return jsonb_build_object('changed',false,'prospect_id',v_prospect_id,
      'previous_status',v_target,'current_status',v_target,'activity_id',null);
  end if;

  if v_target='qualified' then
    select * into v_campaign from public.marketing_sales_scout_campaigns
    where campaign_id=v_prospect.scout_campaign_id;
    if not found
      or coalesce(v_prospect.score,0) < 60
      or v_prospect.score_version is distinct from 'ng-city-b2b-v1'
      or jsonb_typeof(v_prospect.score_factors) is distinct from 'array'
      or v_prospect.do_not_contact_at is not null
      or coalesce(v_prospect.appears_inactive_or_closed,false)
      or coalesce(v_prospect.is_consumer_only,false)
      or not exists (select 1 from unnest(v_campaign.target_categories) category
        where lower(trim(category))=lower(trim(v_prospect.business_category)))
      or lower(trim(coalesce(v_prospect.country,''))) <> lower(trim(v_campaign.country))
      or not (
        lower(trim(coalesce(v_prospect.city,'')))=lower(trim(v_campaign.city))
        or exists (select 1 from unnest(coalesce(v_prospect.service_area_cities,'{}'::text[])) city
          where lower(trim(city))=lower(trim(v_campaign.city)))
      )
      or not exists (select 1 from public.marketing_prospect_channels channel
        where channel.prospect_id=v_prospect_id and channel.is_active
          and channel.platform in ('instagram','facebook','tiktok','x','youtube','website','email','phone','whatsapp'))
    then
      raise exception using errcode='22023', message='prospect does not meet persisted qualification requirements';
    end if;
  end if;

  update public.marketing_prospects set scout_status=v_target, updated_at=now()
  where id=v_prospect_id;
  insert into public.marketing_prospect_activities(
    prospect_id,activity_type,summary,occurred_at,created_by,metadata
  ) values (
    v_prospect_id,'sales_scout','Sales Scout review status changed.',now(),p_actor_id,
    jsonb_build_object('event','scout_status_changed','previous_status',v_prospect.scout_status,
      'target_status',v_target,'reason',v_reason)
  ) returning id into v_activity_id;
  return jsonb_build_object('changed',true,'prospect_id',v_prospect_id,
    'previous_status',v_prospect.scout_status,'current_status',v_target,'activity_id',v_activity_id);
end;
$$;

revoke all on function public.transition_sales_scout_review_status(jsonb,uuid) from public;
revoke all on function public.transition_sales_scout_review_status(jsonb,uuid) from anon;
revoke all on function public.transition_sales_scout_review_status(jsonb,uuid) from authenticated;
grant execute on function public.transition_sales_scout_review_status(jsonb,uuid) to service_role;

revoke all on function public.capture_sales_scout_candidate(jsonb,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.capture_sales_scout_candidate(jsonb,text,uuid,uuid) to service_role;
revoke all on function public.update_sales_scout_qualification_facts(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.update_sales_scout_qualification_facts(jsonb,uuid) to service_role;

notify pgrst,'reload schema';
commit;


begin;

alter table public.marketing_sales_scout_campaigns
  add column if not exists discovery_latitude numeric,
  add column if not exists discovery_longitude numeric,
  add column if not exists discovery_radius_km integer,
  add column if not exists discovery_default_limit integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_sales_scout_campaigns'::regclass and conname='marketing_sales_scout_campaigns_discovery_latitude_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_latitude_check check (discovery_latitude is null or discovery_latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_sales_scout_campaigns'::regclass and conname='marketing_sales_scout_campaigns_discovery_longitude_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_longitude_check check (discovery_longitude is null or discovery_longitude between -180 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_sales_scout_campaigns'::regclass and conname='marketing_sales_scout_campaigns_discovery_radius_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_radius_check check (discovery_radius_km is null or discovery_radius_km between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.marketing_sales_scout_campaigns'::regclass and conname='marketing_sales_scout_campaigns_discovery_limit_check') then
    alter table public.marketing_sales_scout_campaigns add constraint marketing_sales_scout_campaigns_discovery_limit_check check (discovery_default_limit is null or discovery_default_limit between 1 and 50);
  end if;
end $$;

update public.marketing_sales_scout_campaigns
set discovery_latitude=coalesce(discovery_latitude,6.5244), discovery_longitude=coalesce(discovery_longitude,3.3792), discovery_radius_km=coalesce(discovery_radius_km,40), discovery_default_limit=coalesce(discovery_default_limit,25)
where lower(trim(city))='lagos' and lower(trim(country))='nigeria';

create table if not exists public.marketing_sales_scout_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  scout_campaign_id uuid not null references public.marketing_sales_scout_campaigns(campaign_id) on delete cascade,
  provider text not null check (provider='dataforseo_business_listings'),
  status text not null check (status in ('running','completed','failed')),
  requested_categories text[] not null check (cardinality(requested_categories) between 1 and 10),
  requested_result_limit integer not null check (requested_result_limit between 1 and 50),
  latitude numeric not null check (latitude between -90 and 90), longitude numeric not null check (longitude between -180 and 180), radius_km integer not null check (radius_km between 1 and 100),
  provider_task_id text, provider_cost_usd numeric(12,6) check (provider_cost_usd is null or provider_cost_usd>=0), raw_result_count integer not null default 0 check (raw_result_count>=0), staged_candidate_count integer not null default 0 check (staged_candidate_count>=0), exact_duplicate_count integer not null default 0 check (exact_duplicate_count>=0), completion_payload_fingerprint text,
  error_reference text, error_safe_message text, started_by uuid not null, started_at timestamptz not null default now(), completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists marketing_sales_scout_discovery_runs_one_running_uidx on public.marketing_sales_scout_discovery_runs(scout_campaign_id) where status='running';
create index if not exists marketing_sales_scout_discovery_runs_campaign_started_idx on public.marketing_sales_scout_discovery_runs(scout_campaign_id,started_at desc);

create table if not exists public.marketing_sales_scout_discovery_candidates (
 id uuid primary key default gen_random_uuid(), discovery_run_id uuid not null references public.marketing_sales_scout_discovery_runs(id) on delete restrict, last_discovery_run_id uuid not null references public.marketing_sales_scout_discovery_runs(id) on delete restrict, scout_campaign_id uuid not null references public.marketing_sales_scout_campaigns(campaign_id) on delete cascade, provider text not null check(provider='dataforseo_business_listings'), provider_source_id text not null check(length(trim(provider_source_id)) between 1 and 300), status text not null default 'new' check(status in('new','reviewing','duplicate','captured','dismissed')), business_name text not null check(length(trim(business_name)) between 1 and 200), provider_category text, mapped_campaign_category text, provider_category_ids jsonb not null default '[]'::jsonb check(jsonb_typeof(provider_category_ids)='array'), additional_categories jsonb not null default '[]'::jsonb check(jsonb_typeof(additional_categories)='array'), mapping_issues jsonb not null default '[]'::jsonb check(jsonb_typeof(mapping_issues)='array'), provider_source_url text, public_description text, full_address text, city text, state text, country_code text check(country_code is null or length(trim(country_code))=2), latitude numeric check(latitude is null or latitude between -90 and 90), longitude numeric check(longitude is null or longitude between -180 and 180), public_phone text, public_website text, rating_value numeric check(rating_value is null or rating_value>=0), rating_count integer check(rating_count is null or rating_count>=0), claimed_indication boolean, operating_status text, observed_at timestamptz not null, normalized_business_name text not null check(length(trim(normalized_business_name)) between 1 and 200), normalized_city text, prepared_score integer check(prepared_score is null or prepared_score between 0 and 100), score_version text, score_factors jsonb not null default '[]'::jsonb check(jsonb_typeof(score_factors)='array'), exact_matching_prospect_id uuid references public.marketing_prospects(id) on delete set null, soft_match_warning_count integer not null default 0 check(soft_match_warning_count>=0), captured_prospect_id uuid references public.marketing_prospects(id) on delete set null, dismissal_reason text, reviewed_by uuid, reviewed_at timestamptz, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), seen_count integer not null default 1 check(seen_count>=1), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(status<>'dismissed' or length(trim(coalesce(dismissal_reason,'')))>0), check(status<>'captured' or captured_prospect_id is not null), check(status<>'duplicate' or exact_matching_prospect_id is not null)
);
create unique index if not exists marketing_sales_scout_discovery_candidates_identity_uidx on public.marketing_sales_scout_discovery_candidates(scout_campaign_id,provider,provider_source_id);
create index if not exists marketing_sales_scout_discovery_candidates_review_idx on public.marketing_sales_scout_discovery_candidates(scout_campaign_id,status,last_seen_at desc);
create table if not exists public.marketing_sales_scout_discovery_run_candidates (
 discovery_run_id uuid not null references public.marketing_sales_scout_discovery_runs(id) on delete cascade, candidate_id uuid not null references public.marketing_sales_scout_discovery_candidates(id) on delete cascade, is_exact_duplicate boolean not null default false, exact_matching_prospect_id uuid references public.marketing_prospects(id) on delete set null, soft_match_warning_count integer not null default 0 check(soft_match_warning_count>=0), created_at timestamptz not null default now(), primary key(discovery_run_id,candidate_id), check(not is_exact_duplicate or exact_matching_prospect_id is not null)
);
create index if not exists marketing_sales_scout_discovery_membership_candidate_idx on public.marketing_sales_scout_discovery_run_candidates(candidate_id,created_at desc);
alter table public.marketing_sales_scout_discovery_runs enable row level security; alter table public.marketing_sales_scout_discovery_candidates enable row level security; alter table public.marketing_sales_scout_discovery_run_candidates enable row level security;
revoke all on table public.marketing_sales_scout_discovery_runs,public.marketing_sales_scout_discovery_candidates,public.marketing_sales_scout_discovery_run_candidates from public,anon,authenticated;
grant select,insert,update,delete on table public.marketing_sales_scout_discovery_runs,public.marketing_sales_scout_discovery_candidates,public.marketing_sales_scout_discovery_run_candidates to service_role;

create or replace function public.start_sales_scout_discovery_run(p_campaign_id uuid,p_categories text[],p_result_limit integer,p_actor_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_campaign public.marketing_sales_scout_campaigns%rowtype; v_categories text[]; v_run public.marketing_sales_scout_discovery_runs%rowtype;
begin
 if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for discovery run start'; end if;
 select * into v_campaign from public.marketing_sales_scout_campaigns where campaign_id=p_campaign_id for update;
 if not found then raise exception using errcode='P0002',message='discovery campaign not found'; end if;
 if v_campaign.status<>'active' then raise exception using errcode='22023',message='discovery campaign must be active'; end if;
 if v_campaign.discovery_latitude is null or v_campaign.discovery_longitude is null or v_campaign.discovery_radius_km is null or v_campaign.discovery_default_limit is null then raise exception using errcode='22023',message='discovery campaign configuration is incomplete'; end if;
 if p_categories is null or cardinality(p_categories) not between 1 and 10 or exists(select 1 from unnest(p_categories) x where x is null or trim(x)='') then raise exception using errcode='22023',message='discovery categories are invalid'; end if;
 select array_agg(trim(x) order by ordinality) into v_categories from unnest(p_categories) with ordinality t(x,ordinality);
 if exists(select 1 from unnest(v_categories) x group by lower(x) having count(*)>1) then raise exception using errcode='22023',message='discovery categories contain duplicates'; end if;
 if p_result_limit not between 1 and 50 then raise exception using errcode='22023',message='discovery result limit is invalid'; end if;
 if (select count(*) from public.marketing_sales_scout_discovery_runs where scout_campaign_id=p_campaign_id and started_at >= date_trunc('day',now() at time zone 'utc') at time zone 'utc' and started_at < (date_trunc('day',now() at time zone 'utc')+interval '1 day') at time zone 'utc')>=3 then raise exception using errcode='22023',message='discovery daily run limit reached'; end if;
 insert into public.marketing_sales_scout_discovery_runs(scout_campaign_id,provider,status,requested_categories,requested_result_limit,latitude,longitude,radius_km,started_by) values(p_campaign_id,'dataforseo_business_listings','running',v_categories,p_result_limit,v_campaign.discovery_latitude,v_campaign.discovery_longitude,v_campaign.discovery_radius_km,p_actor_id) returning * into v_run;
 return jsonb_build_object('runId',v_run.id,'campaignId',v_run.scout_campaign_id,'status',v_run.status,'requestedCategories',v_run.requested_categories,'latitude',v_run.latitude,'longitude',v_run.longitude,'radiusKm',v_run.radius_km,'limit',v_run.requested_result_limit);
end $$;

-- Completion validates the envelope and duplicate provider IDs before all mutation; membership totals are authoritative.
create or replace function public.complete_sales_scout_discovery_run(
  p_run_id uuid,
  p_payload jsonb,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_run public.marketing_sales_scout_discovery_runs%rowtype;
  v_campaign public.marketing_sales_scout_campaigns%rowtype;
  v_item jsonb;
  v_candidate_id uuid;
  v_exact_id uuid;
  v_exact boolean;
  v_fingerprint text;
  v_candidate_count integer;
  v_staged integer;
  v_exact_count integer;
  v_field text;
  v_observed_at timestamptz;
  v_prepared_score integer;
  v_soft_warning_count integer;
  v_rating_count integer;
  v_rating_value numeric;
  v_latitude numeric;
  v_longitude numeric;
  v_claimed_indication boolean;
  v_source_url text;
  v_source_authority text;
  v_provider_category_ids jsonb;
  v_additional_categories jsonb;
  v_mapping_issues jsonb;
begin
  if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for discovery completion'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception using errcode='22023',message='discovery completion payload is invalid'; end if;
  select * into v_run from public.marketing_sales_scout_discovery_runs where id=p_run_id for update;
  if not found then raise exception using errcode='P0002',message='discovery run not found'; end if;
  v_fingerprint:=md5(p_payload::text);
  if v_run.status='completed' then
    if v_run.completion_payload_fingerprint=v_fingerprint then return jsonb_build_object('runId',v_run.id,'status','completed','stagedCandidateCount',v_run.staged_candidate_count,'exactDuplicateCount',v_run.exact_duplicate_count); end if;
    raise exception using errcode='22023',message='discovery completion payload differs from completed run';
  end if;
  if v_run.status<>'running' then raise exception using errcode='22023',message='discovery run is not running'; end if;
  select * into v_campaign from public.marketing_sales_scout_campaigns where campaign_id=v_run.scout_campaign_id;
  if not found or v_campaign.status <> 'active' then raise exception using errcode='22023',message='discovery campaign must be active'; end if;
  if nullif(trim(p_payload->>'providerTaskId'),'') is null or length(trim(p_payload->>'providerTaskId'))>300 or jsonb_typeof(p_payload->'providerCostUsd')<>'number' or jsonb_typeof(p_payload->'rawResultCount')<>'number' or jsonb_typeof(p_payload->'candidates') is distinct from 'array' then raise exception using errcode='22023',message='discovery completion payload is invalid'; end if;
  if (p_payload->>'providerCostUsd')::numeric<0 or (p_payload->>'providerCostUsd')::numeric>999999.999999 or (p_payload->>'rawResultCount')::numeric<0 or (p_payload->>'rawResultCount')::numeric>2147483647 or trunc((p_payload->>'rawResultCount')::numeric)<>(p_payload->>'rawResultCount')::numeric then raise exception using errcode='22023',message='discovery completion payload is invalid'; end if;
  v_candidate_count:=jsonb_array_length(p_payload->'candidates');
  if v_candidate_count>v_run.requested_result_limit or (p_payload->>'rawResultCount')::integer<v_candidate_count then raise exception using errcode='22023',message='discovery completion payload is invalid'; end if;

  -- First pass: all casts are preceded by JSON type validation.
  for v_item in select value from jsonb_array_elements(p_payload->'candidates') loop
    if jsonb_typeof(v_item) <> 'object'
      or jsonb_typeof(v_item->'providerSourceId') <> 'string'
      or nullif(trim(v_item->>'providerSourceId'),'') is null
      or length(trim(v_item->>'providerSourceId')) > 300
      or jsonb_typeof(v_item->'businessName') <> 'string'
      or nullif(trim(v_item->>'businessName'),'') is null
      or length(trim(v_item->>'businessName')) > 200
      or jsonb_typeof(v_item->'normalizedBusinessName') <> 'string'
      or nullif(trim(v_item->>'normalizedBusinessName'),'') is null
      or length(trim(v_item->>'normalizedBusinessName')) > 200
      or jsonb_typeof(v_item->'observedAt') <> 'string'
      or nullif(trim(v_item->>'observedAt'),'') is null
      or jsonb_typeof(v_item->'providerCategoryIds') is distinct from 'array'
      or jsonb_typeof(v_item->'additionalCategories') is distinct from 'array'
      or jsonb_typeof(v_item->'mappingIssues') is distinct from 'array'
      or jsonb_typeof(v_item->'scoreFactors') is distinct from 'array'
    then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end if;

    foreach v_field in array array['providerCategory','mappedCampaignCategory','description','fullAddress','city','state','countryCode','phone','website','operatingStatus','normalizedCity','scoreVersion','providerSourceUrl'] loop
      if (v_item ? v_field) and jsonb_typeof(v_item->v_field) <> 'null' then
        if jsonb_typeof(v_item->v_field) <> 'string' or nullif(trim(v_item->>v_field),'') is null then
          raise exception using errcode='22023',message='discovery candidate payload is invalid';
        end if;
      end if;
    end loop;

    begin
      v_observed_at := trim(v_item->>'observedAt')::timestamptz;
    exception when others then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end;

    if (v_item ? 'countryCode') and jsonb_typeof(v_item->'countryCode') <> 'null' and length(trim(v_item->>'countryCode')) <> 2 then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end if;
    if (v_item ? 'mappedCampaignCategory') and jsonb_typeof(v_item->'mappedCampaignCategory') <> 'null' and not exists(select 1 from unnest(v_campaign.target_categories) x where lower(trim(x))=lower(trim(v_item->>'mappedCampaignCategory'))) then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end if;

    foreach v_field in array array['providerCategoryIds','additionalCategories','mappingIssues'] loop
      if jsonb_array_length(v_item->v_field)>100 or exists(select 1 from jsonb_array_elements(v_item->v_field) x where jsonb_typeof(x)<>'string' or nullif(trim(x#>>'{}'),'') is null) then
        raise exception using errcode='22023',message='discovery candidate payload is invalid';
      end if;
    end loop;

    foreach v_field in array array['preparedScore','softMatchWarningCount','ratingCount','ratingValue','latitude','longitude'] loop
      if (v_item ? v_field) and jsonb_typeof(v_item->v_field) <> 'null' and jsonb_typeof(v_item->v_field) <> 'number' then
        raise exception using errcode='22023',message='discovery candidate payload is invalid';
      end if;
    end loop;
    if (v_item ? 'claimedIndication') and jsonb_typeof(v_item->'claimedIndication') not in ('null','boolean') then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end if;

    begin
      v_prepared_score := case when jsonb_typeof(v_item->'preparedScore')='number' then (v_item->>'preparedScore')::integer end;
      v_soft_warning_count := case when jsonb_typeof(v_item->'softMatchWarningCount')='number' then (v_item->>'softMatchWarningCount')::integer else 0 end;
      v_rating_count := case when jsonb_typeof(v_item->'ratingCount')='number' then (v_item->>'ratingCount')::integer end;
      v_rating_value := case when jsonb_typeof(v_item->'ratingValue')='number' then (v_item->>'ratingValue')::numeric end;
      v_latitude := case when jsonb_typeof(v_item->'latitude')='number' then (v_item->>'latitude')::numeric end;
      v_longitude := case when jsonb_typeof(v_item->'longitude')='number' then (v_item->>'longitude')::numeric end;
      v_claimed_indication := case when jsonb_typeof(v_item->'claimedIndication')='boolean' then (v_item->>'claimedIndication')::boolean end;
    exception when numeric_value_out_of_range or invalid_text_representation then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end;
    if (jsonb_typeof(v_item->'preparedScore')='number' and ((v_item->>'preparedScore')::numeric<>trunc((v_item->>'preparedScore')::numeric) or v_prepared_score not between 0 and 100 or jsonb_typeof(v_item->'scoreVersion')<>'string' or v_item->>'scoreVersion'<>'ng-city-b2b-v1')) or ((not (v_item ? 'preparedScore') or jsonb_typeof(v_item->'preparedScore')='null') and (v_item ? 'scoreVersion') and jsonb_typeof(v_item->'scoreVersion')<>'null') or v_soft_warning_count<0 or (v_rating_count is not null and (v_rating_count<0 or (v_item->>'ratingCount')::numeric<>trunc((v_item->>'ratingCount')::numeric))) or v_rating_value<0 or v_latitude not between -90 and 90 or v_longitude not between -180 and 180 then
      raise exception using errcode='22023',message='discovery candidate payload is invalid';
    end if;

    if (v_item ? 'providerSourceUrl') and jsonb_typeof(v_item->'providerSourceUrl') <> 'null' then
      v_source_url:=trim(v_item->>'providerSourceUrl');
      if v_source_url ~ '\s' or v_source_url !~* '^https?://' then raise exception using errcode='22023',message='discovery candidate payload is invalid'; end if;
      v_source_authority:=substring(v_source_url from '^[a-zA-Z]+://([^/?#]+)');
      if coalesce(v_source_authority,'')='' or v_source_authority like '%@%' or lower(v_source_authority) ~ '^(localhost|127\.|\[::1\]|::1)(:|$)' then raise exception using errcode='22023',message='discovery candidate payload is invalid'; end if;
    end if;

    if (v_item ? 'exactMatchingProspectId') and jsonb_typeof(v_item->'exactMatchingProspectId') <> 'null' then
      if jsonb_typeof(v_item->'exactMatchingProspectId')<>'string' or nullif(trim(v_item->>'exactMatchingProspectId'),'') is null then raise exception using errcode='22023',message='discovery candidate payload is invalid'; end if;
      begin
        v_exact_id:=trim(v_item->>'exactMatchingProspectId')::uuid;
      exception when invalid_text_representation then
        raise exception using errcode='22023',message='discovery candidate payload is invalid';
      end;
      if not exists(select 1 from public.marketing_prospects where id=v_exact_id) then raise exception using errcode='22023',message='discovery candidate payload is invalid'; end if;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_payload->'candidates') x group by lower(trim(x->>'providerSourceId')) having count(*)>1) then raise exception using errcode='22023',message='discovery completion contains duplicate provider identities'; end if;

  -- Second pass: persist every validated canonical field and one membership row.
  for v_item in select value from jsonb_array_elements(p_payload->'candidates') loop
    v_exact_id:=nullif(trim(v_item->>'exactMatchingProspectId'),'')::uuid; v_exact:=v_exact_id is not null;
    insert into public.marketing_sales_scout_discovery_candidates(discovery_run_id,last_discovery_run_id,scout_campaign_id,provider,provider_source_id,business_name,provider_category,mapped_campaign_category,provider_category_ids,additional_categories,mapping_issues,provider_source_url,public_description,full_address,city,state,country_code,latitude,longitude,public_phone,public_website,rating_value,rating_count,claimed_indication,operating_status,observed_at,normalized_business_name,normalized_city,prepared_score,score_version,score_factors,exact_matching_prospect_id,soft_match_warning_count,status) values(v_run.id,v_run.id,v_run.scout_campaign_id,'dataforseo_business_listings',trim(v_item->>'providerSourceId'),trim(v_item->>'businessName'),nullif(trim(v_item->>'providerCategory'),''),nullif(trim(v_item->>'mappedCampaignCategory'),''),(select jsonb_agg(trim(x#>>'{}')) from jsonb_array_elements(v_item->'providerCategoryIds') x),(select jsonb_agg(trim(x#>>'{}')) from jsonb_array_elements(v_item->'additionalCategories') x),(select jsonb_agg(trim(x#>>'{}')) from jsonb_array_elements(v_item->'mappingIssues') x),nullif(trim(v_item->>'providerSourceUrl'),''),nullif(trim(v_item->>'description'),''),nullif(trim(v_item->>'fullAddress'),''),nullif(trim(v_item->>'city'),''),nullif(trim(v_item->>'state'),''),nullif(trim(v_item->>'countryCode'),''),nullif(v_item->>'latitude','')::numeric,nullif(v_item->>'longitude','')::numeric,nullif(trim(v_item->>'phone'),''),nullif(trim(v_item->>'website'),''),nullif(v_item->>'ratingValue','')::numeric,nullif(v_item->>'ratingCount','')::integer,nullif(v_item->>'claimedIndication','')::boolean,nullif(trim(v_item->>'operatingStatus'),''),(v_item->>'observedAt')::timestamptz,trim(v_item->>'normalizedBusinessName'),nullif(trim(v_item->>'normalizedCity'),''),nullif(v_item->>'preparedScore','')::integer,nullif(trim(v_item->>'scoreVersion'),''),v_item->'scoreFactors',v_exact_id,coalesce((v_item->>'softMatchWarningCount')::integer,0),case when v_exact then 'duplicate' else 'new' end) on conflict(scout_campaign_id,provider,provider_source_id) do update set last_discovery_run_id=excluded.last_discovery_run_id,last_seen_at=now(),seen_count=marketing_sales_scout_discovery_candidates.seen_count+1,business_name=excluded.business_name,provider_category=excluded.provider_category,mapped_campaign_category=excluded.mapped_campaign_category,provider_category_ids=excluded.provider_category_ids,additional_categories=excluded.additional_categories,mapping_issues=excluded.mapping_issues,provider_source_url=excluded.provider_source_url,public_description=excluded.public_description,full_address=excluded.full_address,city=excluded.city,state=excluded.state,country_code=excluded.country_code,latitude=excluded.latitude,longitude=excluded.longitude,public_phone=excluded.public_phone,public_website=excluded.public_website,rating_value=excluded.rating_value,rating_count=excluded.rating_count,claimed_indication=excluded.claimed_indication,operating_status=excluded.operating_status,observed_at=excluded.observed_at,normalized_business_name=excluded.normalized_business_name,normalized_city=excluded.normalized_city,prepared_score=excluded.prepared_score,score_version=excluded.score_version,score_factors=excluded.score_factors,exact_matching_prospect_id=excluded.exact_matching_prospect_id,soft_match_warning_count=excluded.soft_match_warning_count,status=case when marketing_sales_scout_discovery_candidates.status in('captured','dismissed') then marketing_sales_scout_discovery_candidates.status when excluded.exact_matching_prospect_id is not null then 'duplicate' when marketing_sales_scout_discovery_candidates.status='reviewing' then 'reviewing' else 'new' end returning id into v_candidate_id;
    insert into public.marketing_sales_scout_discovery_run_candidates(discovery_run_id,candidate_id,is_exact_duplicate,exact_matching_prospect_id,soft_match_warning_count) values(v_run.id,v_candidate_id,v_exact,v_exact_id,coalesce((v_item->>'softMatchWarningCount')::integer,0)) on conflict do nothing;
  end loop;
  select count(*),count(*) filter(where is_exact_duplicate) into v_staged,v_exact_count from public.marketing_sales_scout_discovery_run_candidates where discovery_run_id=v_run.id;
  update public.marketing_sales_scout_discovery_runs set status='completed',provider_task_id=trim(p_payload->>'providerTaskId'),provider_cost_usd=(p_payload->>'providerCostUsd')::numeric,raw_result_count=(p_payload->>'rawResultCount')::integer,staged_candidate_count=v_staged,exact_duplicate_count=v_exact_count,completion_payload_fingerprint=v_fingerprint,completed_at=now(),updated_at=now() where id=v_run.id;
  return jsonb_build_object('runId',v_run.id,'status','completed','stagedCandidateCount',v_staged,'exactDuplicateCount',v_exact_count);
end;
$$;
create or replace function public.fail_sales_scout_discovery_run(p_run_id uuid,p_error_reference text,p_error_safe_message text,p_actor_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_run public.marketing_sales_scout_discovery_runs%rowtype;
begin
 if p_actor_id is null then raise exception using errcode='22023',message='actor id is required for discovery failure'; end if;
 p_error_reference:=trim(p_error_reference); p_error_safe_message:=trim(p_error_safe_message); if nullif(p_error_reference,'') is null or length(p_error_reference)>120 or nullif(p_error_safe_message,'') is null or length(p_error_safe_message)>500 then raise exception using errcode='22023',message='discovery failure details are required'; end if;
 select * into v_run from public.marketing_sales_scout_discovery_runs where id=p_run_id for update; if not found then raise exception using errcode='P0002',message='discovery run not found'; end if;
 if v_run.status='failed' and v_run.error_reference=p_error_reference and v_run.error_safe_message=p_error_safe_message then return jsonb_build_object('runId',v_run.id,'status','failed'); end if;
 if v_run.status<>'running' then raise exception using errcode='22023',message='discovery run is not running'; end if;
 update public.marketing_sales_scout_discovery_runs set status='failed',error_reference=p_error_reference,error_safe_message=p_error_safe_message,completed_at=now(),updated_at=now() where id=v_run.id;
 return jsonb_build_object('runId',v_run.id,'status','failed');
end $$;
revoke all on function public.start_sales_scout_discovery_run(uuid,text[],integer,uuid),public.complete_sales_scout_discovery_run(uuid,jsonb,uuid),public.fail_sales_scout_discovery_run(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.start_sales_scout_discovery_run(uuid,text[],integer,uuid),public.complete_sales_scout_discovery_run(uuid,jsonb,uuid),public.fail_sales_scout_discovery_run(uuid,text,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;