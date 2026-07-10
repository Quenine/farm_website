-- Universal delivery-rate verification report.
-- Safe read-only SQL. Run after database/backfill-universal-rates-for-existing-products.sql.
-- Expected model for every active fixed-price orderable product:
--   each of 37 states + city = 'All' + pickup_point/home_delivery/farm_pickup.

with states(state) as (
  values
    ('Abia'),
    ('Adamawa'),
    ('Akwa Ibom'),
    ('Anambra'),
    ('Bauchi'),
    ('Bayelsa'),
    ('Benue'),
    ('Borno'),
    ('Cross River'),
    ('Delta'),
    ('Ebonyi'),
    ('Edo'),
    ('Ekiti'),
    ('Enugu'),
    ('FCT'),
    ('Gombe'),
    ('Imo'),
    ('Jigawa'),
    ('Kaduna'),
    ('Kano'),
    ('Katsina'),
    ('Kebbi'),
    ('Kogi'),
    ('Kwara'),
    ('Lagos'),
    ('Nasarawa'),
    ('Niger'),
    ('Ogun'),
    ('Ondo'),
    ('Osun'),
    ('Oyo'),
    ('Plateau'),
    ('Rivers'),
    ('Sokoto'),
    ('Taraba'),
    ('Yobe'),
    ('Zamfara')
), methods(delivery_method, expected_package_size, expected_first_package_fee, expected_extra_package_fee) as (
  values
    ('pickup_point', 1::numeric, 10000::numeric, 3000::numeric),
    ('home_delivery', 1::numeric, 15000::numeric, 3000::numeric),
    ('farm_pickup', 1::numeric, 0::numeric, 0::numeric)
), eligible_products as (
  select id, slug, name
  from public.products
  where status = 'active'
    and is_orderable_online = true
    and pricing_mode = 'fixed'
    and price is not null
    and price > 0
), expected_rates as (
  select
    eligible_products.id as product_id,
    eligible_products.slug,
    eligible_products.name,
    states.state,
    methods.delivery_method,
    methods.expected_package_size,
    methods.expected_first_package_fee,
    methods.expected_extra_package_fee
  from eligible_products
  cross join states
  cross join methods
), actual_universal_rates as (
  select *
  from public.product_delivery_rates
  where is_active = true
    and lower(city) = 'all'
), missing_rates as (
  select expected_rates.*
  from expected_rates
  where not exists (
    select 1
    from actual_universal_rates actual
    where actual.product_id = expected_rates.product_id
      and lower(actual.state) = lower(expected_rates.state)
      and actual.delivery_method = expected_rates.delivery_method
  )
), misconfigured_rates as (
  select
    p.name,
    p.slug,
    actual.state,
    actual.delivery_method,
    actual.package_size,
    actual.first_package_fee,
    actual.extra_package_fee,
    methods.expected_package_size,
    methods.expected_first_package_fee,
    methods.expected_extra_package_fee
  from actual_universal_rates actual
  join public.products p on p.id = actual.product_id
  join methods on methods.delivery_method = actual.delivery_method
  where p.status = 'active'
    and p.is_orderable_online = true
    and p.pricing_mode = 'fixed'
    and (
      actual.package_size <> methods.expected_package_size
      or actual.first_package_fee <> methods.expected_first_package_fee
      or actual.extra_package_fee <> methods.expected_extra_package_fee
    )
), state_readiness as (
  select
    expected_rates.state,
    count(*) filter (where missing_rates.product_id is null) as ready_count,
    count(*) filter (where missing_rates.product_id is not null) as missing_count
  from expected_rates
  left join missing_rates
    on missing_rates.product_id = expected_rates.product_id
   and missing_rates.state = expected_rates.state
   and missing_rates.delivery_method = expected_rates.delivery_method
  group by expected_rates.state
), missing_pickup_products as (
  select distinct name || ' (' || slug || ')' as item
  from missing_rates
  where delivery_method = 'pickup_point'
), missing_home_products as (
  select distinct name || ' (' || slug || ')' as item
  from missing_rates
  where delivery_method = 'home_delivery'
), missing_farm_products as (
  select distinct name || ' (' || slug || ')' as item
  from missing_rates
  where delivery_method = 'farm_pickup'
)
select 'active_fixed_orderable_product_count' as report, count(*)::text as detail
from eligible_products

union all

select 'state_count', count(*)::text
from states

union all

select 'expected_universal_rate_count', (count(*) * 37 * 3)::text
from eligible_products

union all

select 'actual_active_city_all_universal_rate_count', count(*)::text
from actual_universal_rates actual
join eligible_products p on p.id = actual.product_id
where exists (select 1 from states where lower(states.state) = lower(actual.state))
  and actual.delivery_method in ('pickup_point', 'home_delivery', 'farm_pickup')

union all

select 'missing_state_product_method_count', count(*)::text
from missing_rates

union all

select 'missing_states_products_methods', coalesce(string_agg(name || ' (' || slug || ') / ' || state || ' / ' || delivery_method, '; ' order by name, state, delivery_method), 'none')
from missing_rates

union all

select 'products_missing_pickup_point_universal_rates', coalesce((select string_agg(item, ', ' order by item) from missing_pickup_products), 'none')

union all

select 'products_missing_home_delivery_universal_rates', coalesce((select string_agg(item, ', ' order by item) from missing_home_products), 'none')

union all

select 'products_missing_farm_pickup_universal_rates', coalesce((select string_agg(item, ', ' order by item) from missing_farm_products), 'none')

union all

select 'states_not_fallback_ready', coalesce(string_agg(state || ' missing ' || missing_count::text, '; ' order by state), 'none')
from state_readiness
where missing_count > 0

union all

select 'misconfigured_city_all_universal_rate_count', count(*)::text
from misconfigured_rates

union all

select 'misconfigured_city_all_universal_rate_details', coalesce(string_agg(name || ' (' || slug || ') / ' || state || ' / ' || delivery_method || ' has package_size=' || package_size::text || ', first=' || first_package_fee::text || ', extra=' || extra_package_fee::text, '; ' order by name, state, delivery_method), 'none')
from misconfigured_rates;