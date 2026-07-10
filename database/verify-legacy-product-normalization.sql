-- Legacy product normalization verification report.
-- Safe read-only SQL. Run after:
--   1. database/normalize-legacy-products.sql
--   2. database/backfill-universal-rates-for-existing-products.sql
--      or database/seed-universal-delivery-rates.sql

with legacy_slugs(slug) as (
  values
    ('crate-of-eggs'),
    ('half-crate-of-eggs'),
    ('live-broiler-chicken'),
    ('4-week-broilers'),
    ('6-week-table-size-broilers'),
    ('processed-whole-chicken'),
    ('old-layers'),
    ('manure'),
    ('avocado'),
    ('onions'),
    ('basket-of-tomatoes'),
    ('tomatoes'),
    ('bell-peppers'),
    ('shombo-pepper'),
    ('pepper-ata-rodo'),
    ('carrots'),
    ('cucumber'),
    ('cabbage'),
    ('broccoli'),
    ('cauliflower'),
    ('irish-potatoes'),
    ('sweet-potatoes')
), states(state) as (
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
), legacy_products as (
  select p.*
  from public.products p
  where p.slug in (select slug from legacy_slugs)
     or lower(p.name) like '%avocado%'
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
), eligible_products as (
  select id, slug, name
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
), avocado_products as (
  select *
  from legacy_products
  where slug = 'avocado' or lower(name) like '%avocado%'
), avocado_expected_rates as (
  select
    avocado_products.id as product_id,
    avocado_products.slug,
    avocado_products.name,
    states.state,
    methods.delivery_method
  from avocado_products
  cross join states
  cross join methods
), avocado_missing_rates as (
  select avocado_expected_rates.*
  from avocado_expected_rates
  where not exists (
    select 1
    from public.product_delivery_rates pdr
    where pdr.product_id = avocado_expected_rates.product_id
      and pdr.is_active = true
      and lower(pdr.state) = lower(avocado_expected_rates.state)
      and lower(pdr.city) = 'all'
      and pdr.delivery_method = avocado_expected_rates.delivery_method
  )
), excluded_products as (
  select
    p.name,
    p.slug,
    concat_ws(', ',
      case when p.status <> 'active' then 'inactive' end,
      case when p.pricing_mode = 'quote_required' then 'quote_required' end,
      case when p.is_orderable_online is not true then 'not orderable' end,
      case when p.price is null or p.price <= 0 then 'price missing or zero' end
    ) as reason
  from public.products p
  where not (
    p.status = 'active'
    and p.pricing_mode = 'fixed'
    and p.is_orderable_online = true
    and p.price is not null
    and p.price > 0
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
select 'legacy_products_found' as report,
       coalesce(string_agg(
         legacy_products.slug || ' | ' || legacy_products.name || ' | status=' || legacy_products.status::text || ' | pricing=' || legacy_products.pricing_mode || ' | orderable=' || legacy_products.is_orderable_online::text || ' | price=' || coalesce(legacy_products.price::text, 'null') || ' | delivery_rate_count=' || coalesce(universal_rate_counts.universal_rate_count, 0)::text,
         '; ' order by legacy_products.slug
       ), 'none') as detail
from legacy_products
left join universal_rate_counts on universal_rate_counts.product_id = legacy_products.id

union all

select 'legacy_products_price_gt_zero_but_not_orderable',
       coalesce(string_agg(name || ' (' || slug || ') status=' || status::text || ', pricing=' || pricing_mode || ', orderable=' || is_orderable_online::text || ', price=' || price::text, '; ' order by slug), 'none')
from legacy_products
where price > 0
  and (status <> 'active' or pricing_mode <> 'fixed' or is_orderable_online is not true)

union all

select 'legacy_products_price_gt_zero_with_fewer_than_111_universal_rates',
       coalesce(string_agg(legacy_products.name || ' (' || legacy_products.slug || ') has ' || coalesce(universal_rate_counts.universal_rate_count, 0)::text, '; ' order by legacy_products.slug), 'none')
from legacy_products
left join universal_rate_counts on universal_rate_counts.product_id = legacy_products.id
where legacy_products.price > 0
  and coalesce(universal_rate_counts.universal_rate_count, 0) < 111

union all

select 'avocado_status_report',
       coalesce(string_agg('id=' || id::text || ' | slug=' || slug || ' | name=' || name || ' | status=' || status::text || ' | pricing=' || pricing_mode || ' | orderable=' || is_orderable_online::text || ' | price=' || coalesce(price::text, 'null') || ' | universal_rate_count=' || coalesce(universal_rate_counts.universal_rate_count, 0)::text, '; ' order by slug), 'none')
from avocado_products
left join universal_rate_counts on universal_rate_counts.product_id = avocado_products.id

union all

select 'avocado_missing_states_methods',
       coalesce(string_agg(name || ' (' || slug || ') / ' || state || ' / ' || delivery_method, '; ' order by name, state, delivery_method), 'none')
from avocado_missing_rates

union all

select 'active_fixed_orderable_product_count', count(*)::text
from eligible_products

union all

select 'active_fixed_orderable_products_missing_universal_rate_count', count(*)::text
from missing_rates

union all

select 'products_missing_pickup_point_universal_rates', coalesce((select string_agg(item, ', ' order by item) from missing_pickup_products), 'none')

union all

select 'products_missing_home_delivery_universal_rates', coalesce((select string_agg(item, ', ' order by item) from missing_home_products), 'none')

union all

select 'products_missing_farm_pickup_universal_rates', coalesce((select string_agg(item, ', ' order by item) from missing_farm_products), 'none')

union all

select 'misconfigured_city_all_universal_rates', coalesce(string_agg(name || ' (' || slug || ') / ' || state || ' / ' || delivery_method || ' has package_size=' || package_size::text || ', first=' || first_package_fee::text || ', extra=' || extra_package_fee::text, '; ' order by name, state, delivery_method), 'none')
from misconfigured_rates

union all

select 'products_excluded_from_universal_delivery_rates_and_why',
       coalesce(string_agg(name || ' (' || slug || '): ' || nullif(reason, ''), '; ' order by name), 'none')
from excluded_products
where nullif(reason, '') is not null;