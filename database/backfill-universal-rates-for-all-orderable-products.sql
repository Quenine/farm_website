-- Repeat-safe universal delivery-rate backfill for all orderable products.
-- Run after database/seed-legacy-product-prices.sql on each farm Supabase project.
-- This script does not delete products, product media, orders, or exact-city delivery-rate overrides.
-- It only updates/inserts city = 'All' fallback rows for active fixed-price orderable products with price > 0.

begin;

with nigeria_states(state, sort_order) as (
  values
    ('Abia', 10),
    ('Adamawa', 20),
    ('Akwa Ibom', 30),
    ('Anambra', 40),
    ('Bauchi', 50),
    ('Bayelsa', 60),
    ('Benue', 70),
    ('Borno', 80),
    ('Cross River', 90),
    ('Delta', 100),
    ('Ebonyi', 110),
    ('Edo', 120),
    ('Ekiti', 130),
    ('Enugu', 140),
    ('FCT', 150),
    ('Gombe', 160),
    ('Imo', 170),
    ('Jigawa', 180),
    ('Kaduna', 190),
    ('Kano', 200),
    ('Katsina', 210),
    ('Kebbi', 220),
    ('Kogi', 230),
    ('Kwara', 240),
    ('Lagos', 250),
    ('Nasarawa', 260),
    ('Niger', 270),
    ('Ogun', 280),
    ('Ondo', 290),
    ('Osun', 300),
    ('Oyo', 310),
    ('Plateau', 320),
    ('Rivers', 330),
    ('Sokoto', 340),
    ('Taraba', 350),
    ('Yobe', 360),
    ('Zamfara', 370)
), methods(delivery_method, first_package_fee, extra_package_fee, package_size, estimated_delivery_time, method_sort_order) as (
  values
    ('pickup_point', 10000::numeric, 3000::numeric, 1::numeric, '24-72 hours', 1),
    ('home_delivery', 15000::numeric, 3000::numeric, 1::numeric, '24-72 hours', 2),
    ('farm_pickup', 0::numeric, 0::numeric, 1::numeric, 'By arrangement', 3)
), eligible_products as (
  select id as product_id
  from public.products
  where status = 'active'
    and pricing_mode = 'fixed'
    and is_orderable_online = true
    and price is not null
    and price > 0
), incoming as (
  select
    eligible_products.product_id,
    nigeria_states.state,
    'All'::text as city,
    methods.delivery_method,
    methods.package_size,
    methods.first_package_fee,
    methods.extra_package_fee,
    methods.estimated_delivery_time,
    true as is_active,
    nigeria_states.sort_order + methods.method_sort_order as sort_order
  from eligible_products
  cross join nigeria_states
  cross join methods
)
update public.product_delivery_rates existing
set state = incoming.state,
    city = incoming.city,
    package_size = incoming.package_size,
    first_package_fee = incoming.first_package_fee,
    extra_package_fee = incoming.extra_package_fee,
    estimated_delivery_time = incoming.estimated_delivery_time,
    is_active = incoming.is_active,
    sort_order = incoming.sort_order,
    updated_at = now()
from incoming
where existing.product_id = incoming.product_id
  and lower(existing.state) = lower(incoming.state)
  and lower(existing.city) = 'all'
  and existing.delivery_method = incoming.delivery_method;

with nigeria_states(state, sort_order) as (
  values
    ('Abia', 10),
    ('Adamawa', 20),
    ('Akwa Ibom', 30),
    ('Anambra', 40),
    ('Bauchi', 50),
    ('Bayelsa', 60),
    ('Benue', 70),
    ('Borno', 80),
    ('Cross River', 90),
    ('Delta', 100),
    ('Ebonyi', 110),
    ('Edo', 120),
    ('Ekiti', 130),
    ('Enugu', 140),
    ('FCT', 150),
    ('Gombe', 160),
    ('Imo', 170),
    ('Jigawa', 180),
    ('Kaduna', 190),
    ('Kano', 200),
    ('Katsina', 210),
    ('Kebbi', 220),
    ('Kogi', 230),
    ('Kwara', 240),
    ('Lagos', 250),
    ('Nasarawa', 260),
    ('Niger', 270),
    ('Ogun', 280),
    ('Ondo', 290),
    ('Osun', 300),
    ('Oyo', 310),
    ('Plateau', 320),
    ('Rivers', 330),
    ('Sokoto', 340),
    ('Taraba', 350),
    ('Yobe', 360),
    ('Zamfara', 370)
), methods(delivery_method, first_package_fee, extra_package_fee, package_size, estimated_delivery_time, method_sort_order) as (
  values
    ('pickup_point', 10000::numeric, 3000::numeric, 1::numeric, '24-72 hours', 1),
    ('home_delivery', 15000::numeric, 3000::numeric, 1::numeric, '24-72 hours', 2),
    ('farm_pickup', 0::numeric, 0::numeric, 1::numeric, 'By arrangement', 3)
), eligible_products as (
  select id as product_id
  from public.products
  where status = 'active'
    and pricing_mode = 'fixed'
    and is_orderable_online = true
    and price is not null
    and price > 0
), incoming as (
  select
    eligible_products.product_id,
    nigeria_states.state,
    'All'::text as city,
    methods.delivery_method,
    methods.package_size,
    methods.first_package_fee,
    methods.extra_package_fee,
    methods.estimated_delivery_time,
    true as is_active,
    nigeria_states.sort_order + methods.method_sort_order as sort_order
  from eligible_products
  cross join nigeria_states
  cross join methods
)
insert into public.product_delivery_rates (
  product_id,
  state,
  city,
  delivery_method,
  package_size,
  first_package_fee,
  extra_package_fee,
  estimated_delivery_time,
  is_active,
  sort_order
)
select
  incoming.product_id,
  incoming.state,
  incoming.city,
  incoming.delivery_method,
  incoming.package_size,
  incoming.first_package_fee,
  incoming.extra_package_fee,
  incoming.estimated_delivery_time,
  incoming.is_active,
  incoming.sort_order
from incoming
where not exists (
  select 1
  from public.product_delivery_rates existing
  where existing.product_id = incoming.product_id
    and lower(existing.state) = lower(incoming.state)
    and lower(existing.city) = 'all'
    and existing.delivery_method = incoming.delivery_method
)
on conflict (product_id, state, city, delivery_method)
do update set
  package_size = excluded.package_size,
  first_package_fee = excluded.first_package_fee,
  extra_package_fee = excluded.extra_package_fee,
  estimated_delivery_time = excluded.estimated_delivery_time,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now()
where lower(public.product_delivery_rates.city) = 'all'
  and lower(excluded.city) = 'all';

commit;

-- Expected universal model per eligible product:
--   37 states/FCT x 3 methods = 111 active city = 'All' rates.
--   pickup_point: package_size 1, first package 10000, extra package 3000, ETA 24-72 hours.
--   home_delivery: package_size 1, first package 15000, extra package 3000, ETA 24-72 hours.
--   farm_pickup: package_size 1, first package 0, extra package 0, ETA By arrangement.