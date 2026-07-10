-- All-products orderability and universal delivery-rate verification report.
-- Safe read-only SQL. Run after:
--   1. database/seed-legacy-product-prices.sql
--   2. database/backfill-universal-rates-for-all-orderable-products.sql
-- Expected final result:
--   products_still_not_orderable = none
--   products_with_price_lte_zero_or_null = none
--   active_fixed_orderable_products_with_fewer_than_111_universal_rates = none

with states(state) as (
  values
    ('Abia'), ('Adamawa'), ('Akwa Ibom'), ('Anambra'), ('Bauchi'), ('Bayelsa'),
    ('Benue'), ('Borno'), ('Cross River'), ('Delta'), ('Ebonyi'), ('Edo'),
    ('Ekiti'), ('Enugu'), ('FCT'), ('Gombe'), ('Imo'), ('Jigawa'), ('Kaduna'),
    ('Kano'), ('Katsina'), ('Kebbi'), ('Kogi'), ('Kwara'), ('Lagos'),
    ('Nasarawa'), ('Niger'), ('Ogun'), ('Ondo'), ('Osun'), ('Oyo'), ('Plateau'),
    ('Rivers'), ('Sokoto'), ('Taraba'), ('Yobe'), ('Zamfara')
), methods(delivery_method, expected_package_size, expected_first_package_fee, expected_extra_package_fee) as (
  values
    ('pickup_point', 1::numeric, 10000::numeric, 3000::numeric),
    ('home_delivery', 1::numeric, 15000::numeric, 3000::numeric),
    ('farm_pickup', 1::numeric, 0::numeric, 0::numeric)
), specifically_seeded_slugs(slug) as (
  values
    ('basket-of-tomatoes'),
    ('bell-peppers'),
    ('carrots'),
    ('cucumber'),
    ('irish-potatoes'),
    ('sweet-potatoes'),
    ('shombo-pepper'),
    ('pepper-ata-rodo'),
    ('cabbage'),
    ('broccoli'),
    ('cauliflower'),
    ('avocado'),
    ('onions'),
    ('4-week-broilers'),
    ('6-week-table-size-broilers'),
    ('watermelon-large-above')
), eligible_products as (
  select id, slug, name, price, status, pricing_mode, is_orderable_online
  from public.products
  where status = 'active'
    and pricing_mode = 'fixed'
    and is_orderable_online = true
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
), universal_rate_counts as (
  select
    pdr.product_id,
    count(*) filter (
      where pdr.is_active = true
        and lower(pdr.city) = 'all'
        and exists (select 1 from states where lower(states.state) = lower(pdr.state))
        and pdr.delivery_method in ('pickup_point', 'home_delivery', 'farm_pickup')
    ) as universal_rate_count
  from public.product_delivery_rates pdr
  group by pdr.product_id
), missing_rates as (
  select expected_rates.*
  from expected_rates
  where not exists (
    select 1
    from public.product_delivery_rates pdr
    where pdr.product_id = expected_rates.product_id
      and pdr.is_active = true
      and lower(pdr.state) = lower(expected_rates.state)
      and lower(pdr.city) = 'all'
      and pdr.delivery_method = expected_rates.delivery_method
  )
), misconfigured_rates as (
  select
    p.name,
    p.slug,
    pdr.state,
    pdr.delivery_method,
    pdr.package_size,
    pdr.first_package_fee,
    pdr.extra_package_fee
  from public.product_delivery_rates pdr
  join eligible_products p on p.id = pdr.product_id
  join methods on methods.delivery_method = pdr.delivery_method
  where pdr.is_active = true
    and lower(pdr.city) = 'all'
    and exists (select 1 from states where lower(states.state) = lower(pdr.state))
    and (
      pdr.package_size <> methods.expected_package_size
      or pdr.first_package_fee <> methods.expected_first_package_fee
      or pdr.extra_package_fee <> methods.expected_extra_package_fee
    )
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
select 'total_products' as report, count(*)::text as detail
from public.products

union all

select 'active_fixed_orderable_products', count(*)::text
from eligible_products

union all

select 'products_still_not_orderable',
       coalesce(string_agg(name || ' (' || slug || ') price=' || coalesce(price::text, 'null') || ', status=' || status::text || ', pricing=' || pricing_mode || ', orderable=' || is_orderable_online::text, '; ' order by name), 'none')
from public.products
where status <> 'active'
   or pricing_mode <> 'fixed'
   or is_orderable_online is not true

union all

select 'products_with_price_lte_zero_or_null',
       coalesce(string_agg(name || ' (' || slug || ') price=' || coalesce(price::text, 'null') || ', status=' || status::text || ', pricing=' || pricing_mode, '; ' order by name), 'none')
from public.products
where price is null
   or price <= 0

union all

select 'products_specifically_priced_by_seed_legacy_product_prices',
       coalesce(string_agg(p.name || ' (' || p.slug || ') price=' || coalesce(p.price::text, 'null') || ', rates=' || coalesce(universal_rate_counts.universal_rate_count, 0)::text, '; ' order by p.slug), 'none')
from public.products p
join specifically_seeded_slugs seeded on seeded.slug = p.slug
left join universal_rate_counts on universal_rate_counts.product_id = p.id

union all

select 'active_fixed_orderable_products_and_universal_rate_counts',
       coalesce(string_agg(eligible_products.name || ' (' || eligible_products.slug || ') rates=' || coalesce(universal_rate_counts.universal_rate_count, 0)::text, '; ' order by eligible_products.name), 'none')
from eligible_products
left join universal_rate_counts on universal_rate_counts.product_id = eligible_products.id

union all

select 'active_fixed_orderable_products_with_fewer_than_111_universal_rates',
       coalesce(string_agg(eligible_products.name || ' (' || eligible_products.slug || ') has ' || coalesce(universal_rate_counts.universal_rate_count, 0)::text, '; ' order by eligible_products.name), 'none')
from eligible_products
left join universal_rate_counts on universal_rate_counts.product_id = eligible_products.id
where coalesce(universal_rate_counts.universal_rate_count, 0) < 111

union all

select 'active_fixed_orderable_products_missing_pickup_point_rates', coalesce((select string_agg(item, ', ' order by item) from missing_pickup_products), 'none')

union all

select 'active_fixed_orderable_products_missing_home_delivery_rates', coalesce((select string_agg(item, ', ' order by item) from missing_home_products), 'none')

union all

select 'active_fixed_orderable_products_missing_farm_pickup_rates', coalesce((select string_agg(item, ', ' order by item) from missing_farm_products), 'none')

union all

select 'active_fixed_orderable_missing_state_method_count', count(*)::text
from missing_rates

union all

select 'misconfigured_city_all_universal_rates',
       coalesce(string_agg(name || ' (' || slug || ') / ' || state || ' / ' || delivery_method || ' has package_size=' || package_size::text || ', first=' || first_package_fee::text || ', extra=' || extra_package_fee::text, '; ' order by name, state, delivery_method), 'none')
from misconfigured_rates;