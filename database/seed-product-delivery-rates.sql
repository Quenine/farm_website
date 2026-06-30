with farm_pickup_products as (
  select id as product_id
  from public.products
  where status = 'active'
), incoming as (
  select
    product_id,
    'Oyo'::text as state,
    'Ibadan'::text as city,
    'farm_pickup'::text as delivery_method,
    999999::numeric as package_size,
    0::numeric as first_package_fee,
    0::numeric as extra_package_fee,
    'By arrangement'::text as estimated_delivery_time,
    true as is_active,
    1000::integer as sort_order
  from farm_pickup_products

  union all

  select p.id, rate_values.state, rate_values.city, rate_values.delivery_method,
         rate_values.package_size, rate_values.first_package_fee,
         rate_values.extra_package_fee, rate_values.estimated_delivery_time,
         true, rate_values.sort_order
  from (
    values
      ('onions', 'Lagos', 'Lagos Mainland', 'home_delivery', 1::numeric, 20000::numeric, 12000::numeric, '24-72 hours', 10),
      ('onions', 'Lagos', 'Lagos Mainland', 'pickup_point', 1::numeric, 16000::numeric, 10000::numeric, '24-72 hours', 20),
      ('carrots', 'Lagos', 'Lagos Mainland', 'home_delivery', 1::numeric, 10000::numeric, 7000::numeric, '24-72 hours', 30),
      ('carrots', 'Lagos', 'Lagos Mainland', 'pickup_point', 1::numeric, 8000::numeric, 6000::numeric, '24-72 hours', 40),
      ('basket-of-tomatoes', 'Lagos', 'Lagos Mainland', 'home_delivery', 1::numeric, 15000::numeric, 10000::numeric, '24-72 hours', 50),
      ('basket-of-tomatoes', 'Lagos', 'Lagos Mainland', 'pickup_point', 1::numeric, 12000::numeric, 8000::numeric, '24-72 hours', 60),
      ('irish-potatoes', 'Lagos', 'Lagos Mainland', 'home_delivery', 1::numeric, 18000::numeric, 12000::numeric, '24-72 hours', 70),
      ('irish-potatoes', 'Lagos', 'Lagos Mainland', 'pickup_point', 1::numeric, 15000::numeric, 10000::numeric, '24-72 hours', 80),
      ('sweet-potatoes', 'Lagos', 'Lagos Mainland', 'home_delivery', 1::numeric, 15000::numeric, 9000::numeric, '24-72 hours', 90),
      ('sweet-potatoes', 'Lagos', 'Lagos Mainland', 'pickup_point', 1::numeric, 12000::numeric, 8000::numeric, '24-72 hours', 100),
      ('bell-peppers', 'Lagos', 'Lagos Mainland', 'home_delivery', 1::numeric, 12000::numeric, 8000::numeric, '24-72 hours', 110),
      ('bell-peppers', 'Lagos', 'Lagos Mainland', 'pickup_point', 1::numeric, 10000::numeric, 7000::numeric, '24-72 hours', 120),
      ('pepper-ata-rodo', 'Lagos', 'Lagos Mainland', 'home_delivery', 1::numeric, 13000::numeric, 9000::numeric, '24-72 hours', 130),
      ('pepper-ata-rodo', 'Lagos', 'Lagos Mainland', 'pickup_point', 1::numeric, 10000::numeric, 7000::numeric, '24-72 hours', 140),
      ('crate-of-eggs', 'Oyo', 'Ibadan', 'home_delivery', 1::numeric, 3500::numeric, 1000::numeric, 'Same day or next day', 150),
      ('crate-of-eggs', 'Oyo', 'Ibadan', 'pickup_point', 1::numeric, 2000::numeric, 800::numeric, 'Same day or next day', 160),
      ('half-crate-of-eggs', 'Oyo', 'Ibadan', 'home_delivery', 2::numeric, 3500::numeric, 1000::numeric, 'Same day or next day', 170),
      ('half-crate-of-eggs', 'Oyo', 'Ibadan', 'pickup_point', 2::numeric, 2000::numeric, 800::numeric, 'Same day or next day', 180),
      ('6-week-table-size-broilers', 'Oyo', 'Ibadan', 'home_delivery', 20::numeric, 5000::numeric, 2500::numeric, 'Same day or next day', 190),
      ('6-week-table-size-broilers', 'Oyo', 'Ibadan', 'pickup_point', 20::numeric, 3000::numeric, 1500::numeric, 'Same day or next day', 200),
      ('live-broiler-chicken', 'Oyo', 'Ibadan', 'home_delivery', 20::numeric, 5000::numeric, 2500::numeric, 'Same day or next day', 210),
      ('live-broiler-chicken', 'Oyo', 'Ibadan', 'pickup_point', 20::numeric, 3000::numeric, 1500::numeric, 'Same day or next day', 220),
      ('processed-whole-chicken', 'Oyo', 'Ibadan', 'home_delivery', 20::numeric, 4500::numeric, 2000::numeric, 'Same day or next day', 230),
      ('processed-whole-chicken', 'Oyo', 'Ibadan', 'pickup_point', 20::numeric, 3000::numeric, 1500::numeric, 'Same day or next day', 240),
      ('old-layers', 'Oyo', 'Ibadan', 'home_delivery', 20::numeric, 5000::numeric, 2500::numeric, 'Same day or next day', 245),
      ('old-layers', 'Oyo', 'Ibadan', 'pickup_point', 20::numeric, 3000::numeric, 1500::numeric, 'Same day or next day', 248),
      ('manure', 'Oyo', 'Ibadan', 'home_delivery', 1::numeric, 6000::numeric, 3000::numeric, 'Same day or next day', 250),
      ('manure', 'Oyo', 'Ibadan', 'pickup_point', 1::numeric, 3500::numeric, 2000::numeric, 'Same day or next day', 260)
  ) as rate_values(
    slug, state, city, delivery_method, package_size, first_package_fee,
    extra_package_fee, estimated_delivery_time, sort_order
  )
  join public.products p on p.slug = rate_values.slug
), updated as (
  update public.product_delivery_rates existing
  set package_size = incoming.package_size,
      first_package_fee = incoming.first_package_fee,
      extra_package_fee = incoming.extra_package_fee,
      estimated_delivery_time = incoming.estimated_delivery_time,
      is_active = incoming.is_active,
      sort_order = incoming.sort_order
  from incoming
  where existing.product_id = incoming.product_id
    and lower(existing.state) = lower(incoming.state)
    and lower(existing.city) = lower(incoming.city)
    and existing.delivery_method = incoming.delivery_method
  returning existing.id
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
    and lower(existing.city) = lower(incoming.city)
    and existing.delivery_method = incoming.delivery_method
);
