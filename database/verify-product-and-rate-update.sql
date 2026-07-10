-- Product and universal delivery-rate verification report.
-- Safe read-only SQL. Run after:
--   1. database/seed-updated-crop-products.sql
--   2. database/backfill-universal-rates-for-existing-products.sql

with updated_crop_slugs(slug) as (
  values
    ('ginger-custard-rubber'),
    ('sweet-potatoes-bag'),
    ('sweet-potatoes-big-paint'),
    ('eggplant-bag'),
    ('eggplant-custard-rubber'),
    ('beetroot-bag'),
    ('beetroot-bunch'),
    ('cauliflower-dozen'),
    ('cauliflower-piece'),
    ('broccoli-dozen'),
    ('broccoli-piece'),
    ('cucumber-bag'),
    ('cucumber-rubber'),
    ('carrots-bag'),
    ('carrots-custard-rubber'),
    ('watermelon-small'),
    ('watermelon-medium'),
    ('watermelon-large-above'),
    ('cabbage-small-head'),
    ('cabbage-medium-head'),
    ('cabbage-large-head'),
    ('purple-cabbage-medium-head'),
    ('purple-cabbage-large-head'),
    ('tomatoes-farmers-basket'),
    ('tomatoes-custard-rubber'),
    ('irish-potatoes-bag'),
    ('irish-potatoes-big-rubber'),
    ('shombo-bag'),
    ('tatashe-bag'),
    ('rodo-red-pepper-bag'),
    ('bell-pepper-kg')
), states(state) as (
  values
    ('Abia'), ('Adamawa'), ('Akwa Ibom'), ('Anambra'), ('Bauchi'), ('Bayelsa'),
    ('Benue'), ('Borno'), ('Cross River'), ('Delta'), ('Ebonyi'), ('Edo'),
    ('Ekiti'), ('Enugu'), ('FCT'), ('Gombe'), ('Imo'), ('Jigawa'), ('Kaduna'),
    ('Kano'), ('Katsina'), ('Kebbi'), ('Kogi'), ('Kwara'), ('Lagos'),
    ('Nasarawa'), ('Niger'), ('Ogun'), ('Ondo'), ('Osun'), ('Oyo'), ('Plateau'),
    ('Rivers'), ('Sokoto'), ('Taraba'), ('Yobe'), ('Zamfara')
), methods(delivery_method) as (
  values ('pickup_point'), ('home_delivery'), ('farm_pickup')
), crop_products as (
  select p.*
  from public.products p
  join public.categories c on c.id = p.category_id
  where c.slug = 'crop-produce' or c.name = 'Crop Produce'
), eligible_products as (
  select id, slug, name
  from public.products
  where status = 'active'
    and is_orderable_online = true
    and pricing_mode = 'fixed'
    and price is not null
    and price > 0
), expected_rates as (
  select eligible_products.id as product_id, eligible_products.slug, eligible_products.name, states.state, methods.delivery_method
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
)
select 'active_crop_produce_products' as report, count(*)::text as detail
from crop_products
where status = 'active'

union all

select 'missing_updated_crop_products', coalesce(string_agg(updated_crop_slugs.slug, ', ' order by updated_crop_slugs.slug), 'none')
from updated_crop_slugs
left join public.products p on p.slug = updated_crop_slugs.slug
where p.id is null

union all

select 'pickup_point_product_delivery_rates', count(*)::text
from public.product_delivery_rates
where delivery_method = 'pickup_point' and is_active = true

union all

select 'home_delivery_product_delivery_rates', count(*)::text
from public.product_delivery_rates
where delivery_method = 'home_delivery' and is_active = true

union all

select 'farm_pickup_product_delivery_rates', count(*)::text
from public.product_delivery_rates
where delivery_method = 'farm_pickup' and is_active = true

union all

select 'products_missing_universal_rates', count(distinct product_id)::text
from missing_rates

union all

select 'missing_universal_rate_details', coalesce(string_agg(distinct name || ' / ' || state || ' / ' || delivery_method, '; ' order by name || ' / ' || state || ' / ' || delivery_method), 'none')
from missing_rates

union all

select 'quote_required_products_excluded_from_checkout', coalesce(string_agg(name || ' (' || slug || ')', ', ' order by name), 'none')
from public.products
where status = 'active'
  and (pricing_mode = 'quote_required' or is_orderable_online = false);