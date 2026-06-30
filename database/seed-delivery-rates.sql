with incoming as (
  select *
  from (
    values
      ('Oyo', 'Ibadan', 'home_delivery', 3500::numeric, 2::numeric, 1000::numeric, 'Same day or next day', true, 10),
      ('Oyo', 'Ibadan', 'pickup_point', 2000::numeric, 2::numeric, 800::numeric, 'Same day or next day', true, 20),
      ('Oyo', 'Ibadan', 'farm_pickup', 0::numeric, 999::numeric, 0::numeric, 'By arrangement', true, 30),
      ('Lagos', 'Lagos Mainland', 'pickup_point', 8000::numeric, 2::numeric, 2000::numeric, '24-72 hours', true, 40),
      ('Lagos', 'Lagos Mainland', 'home_delivery', 12000::numeric, 2::numeric, 2500::numeric, '24-72 hours', true, 50),
      ('Lagos', 'Lagos Island', 'pickup_point', 9000::numeric, 2::numeric, 2000::numeric, '24-72 hours', true, 60),
      ('Lagos', 'Lagos Island', 'home_delivery', 14000::numeric, 2::numeric, 2500::numeric, '24-72 hours', true, 70),
      ('FCT', 'Abuja', 'pickup_point', 9000::numeric, 2::numeric, 2000::numeric, '24-72 hours', true, 80),
      ('FCT', 'Abuja', 'home_delivery', 13000::numeric, 2::numeric, 2500::numeric, '24-72 hours', true, 90),
      ('Plateau', 'Jos', 'home_delivery', 4000::numeric, 2::numeric, 1000::numeric, 'Same day or next day', true, 100),
      ('Plateau', 'Jos', 'pickup_point', 2000::numeric, 2::numeric, 800::numeric, 'Same day or next day', true, 110)
  ) as rate_values(
    state,
    city,
    delivery_method,
    base_fee,
    base_delivery_units,
    extra_fee_per_unit,
    estimated_delivery_time,
    is_active,
    sort_order
  )
), updated as (
  update public.delivery_rates existing
  set state = incoming.state,
      city = incoming.city,
      base_fee = incoming.base_fee,
      base_delivery_units = incoming.base_delivery_units,
      extra_fee_per_unit = incoming.extra_fee_per_unit,
      estimated_delivery_time = incoming.estimated_delivery_time,
      is_active = incoming.is_active,
      sort_order = incoming.sort_order
  from incoming
  where lower(existing.state) = lower(incoming.state)
    and lower(existing.city) = lower(incoming.city)
    and existing.delivery_method = incoming.delivery_method
  returning existing.id
)
insert into public.delivery_rates (
  state,
  city,
  delivery_method,
  base_fee,
  base_delivery_units,
  extra_fee_per_unit,
  estimated_delivery_time,
  is_active,
  sort_order
)
select
  incoming.state,
  incoming.city,
  incoming.delivery_method,
  incoming.base_fee,
  incoming.base_delivery_units,
  incoming.extra_fee_per_unit,
  incoming.estimated_delivery_time,
  incoming.is_active,
  incoming.sort_order
from incoming
where not exists (
  select 1
  from public.delivery_rates existing
  where lower(existing.state) = lower(incoming.state)
    and lower(existing.city) = lower(incoming.city)
    and existing.delivery_method = incoming.delivery_method
);