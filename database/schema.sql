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








