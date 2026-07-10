-- Repeat-safe legacy product normalization for Noble Farms / Shields Farms.
-- Run separately on each farm Supabase project.
-- This script does not delete products, orders, product media, stock records, or delivery rates.
-- It updates known legacy products by slug/name and preserves existing prices, stock, and media.

begin;

-- General safety normalization for known legacy slugs.
-- These columns should already be non-null in the current schema, but this keeps older databases tidy.
update public.products
set minimum_order_quantity = coalesce(nullif(minimum_order_quantity, 0), 1),
    quantity_step = coalesce(nullif(quantity_step, 0), 1),
    quantity_input_type = coalesce(nullif(quantity_input_type, ''), 'whole'),
    supports_farm_pickup = coalesce(supports_farm_pickup, true),
    requires_delivery_confirmation = coalesce(requires_delivery_confirmation, false),
    updated_at = now()
where slug in (
  'crate-of-eggs',
  'half-crate-of-eggs',
  'live-broiler-chicken',
  '4-week-broilers',
  '6-week-table-size-broilers',
  'processed-whole-chicken',
  'old-layers',
  'manure',
  'basket-of-tomatoes',
  'tomatoes',
  'bell-peppers',
  'shombo-pepper',
  'pepper-ata-rodo',
  'carrots',
  'cucumber',
  'cabbage',
  'broccoli',
  'cauliflower',
  'onions',
  'avocado',
  'irish-potatoes',
  'sweet-potatoes'
);

-- Eggs: known fixed-price orderable products.
update public.products
set name = case slug
      when 'crate-of-eggs' then 'Crate of Eggs'
      when 'half-crate-of-eggs' then 'Half Crate of Eggs'
      else name
    end,
    unit = case slug
      when 'crate-of-eggs' then 'crate'
      when 'half-crate-of-eggs' then 'half_crate'
      else unit
    end,
    minimum_order_quantity = 5,
    quantity_step = 1,
    quantity_input_type = 'whole',
    pricing_mode = 'fixed',
    is_orderable_online = true,
    status = 'active'::public.product_status,
    supports_home_delivery = true,
    supports_pickup_point = true,
    supports_farm_pickup = true,
    requires_delivery_confirmation = false,
    updated_at = now()
where slug in ('crate-of-eggs', 'half-crate-of-eggs');

-- Poultry and processed birds. Products with a positive price become fixed/orderable;
-- zero-price or quote products remain quote-only and not checkout-enabled.
update public.products
set name = case slug
      when 'live-broiler-chicken' then 'Live Broiler Chicken'
      when '4-week-broilers' then '4-Week Broilers'
      when '6-week-table-size-broilers' then '6-Week Table-Size Broilers'
      when 'processed-whole-chicken' then 'Processed Whole Chicken'
      when 'old-layers' then 'Old Layers'
      else name
    end,
    unit = case slug
      when 'live-broiler-chicken' then 'kg'
      when '6-week-table-size-broilers' then 'kg'
      when 'processed-whole-chicken' then 'kg'
      when 'old-layers' then 'bird'
      when '4-week-broilers' then case when unit in ('bird', 'kg') then unit else 'bird' end
      else unit
    end,
    minimum_order_quantity = case slug
      when 'old-layers' then 10
      when 'live-broiler-chicken' then 5
      when '6-week-table-size-broilers' then 5
      when 'processed-whole-chicken' then 5
      when '4-week-broilers' then coalesce(nullif(minimum_order_quantity, 0), 1)
      else minimum_order_quantity
    end,
    quantity_step = 1,
    quantity_input_type = 'whole',
    pricing_mode = case when price > 0 then 'fixed' else pricing_mode end,
    is_orderable_online = case when price > 0 then true else false end,
    status = 'active'::public.product_status,
    supports_home_delivery = coalesce(supports_home_delivery, true),
    supports_pickup_point = coalesce(supports_pickup_point, true),
    supports_farm_pickup = true,
    requires_delivery_confirmation = false,
    updated_at = now()
where slug in (
  'live-broiler-chicken',
  '4-week-broilers',
  '6-week-table-size-broilers',
  'processed-whole-chicken',
  'old-layers'
);

-- Farm inputs.
update public.products
set name = 'Manure',
    unit = 'bag',
    minimum_order_quantity = 3,
    quantity_step = 1,
    quantity_input_type = 'whole',
    pricing_mode = case when price > 0 then 'fixed' else pricing_mode end,
    is_orderable_online = case when price > 0 then true else false end,
    status = 'active'::public.product_status,
    supports_home_delivery = true,
    supports_pickup_point = true,
    supports_farm_pickup = true,
    requires_delivery_confirmation = false,
    updated_at = now()
where slug = 'manure';

-- Legacy crop produce with positive prices should be available online and delivery-rate eligible.
-- This preserves price, stock, media, and names while filling missing quantity/unit controls.
update public.products
set unit = coalesce(nullif(public.products.unit, ''), crop_defaults.unit),
    minimum_order_quantity = coalesce(nullif(public.products.minimum_order_quantity, 0), crop_defaults.minimum_order_quantity),
    quantity_step = coalesce(nullif(public.products.quantity_step, 0), crop_defaults.quantity_step),
    quantity_input_type = case
      when public.products.quantity_input_type in ('whole', 'decimal') then public.products.quantity_input_type
      else crop_defaults.quantity_input_type
    end,
    pricing_mode = 'fixed',
    is_orderable_online = true,
    status = 'active'::public.product_status,
    supports_home_delivery = true,
    supports_pickup_point = true,
    supports_farm_pickup = true,
    requires_delivery_confirmation = false,
    supports_wider_delivery = true,
    updated_at = now()
from (
  values
    ('avocado', 'piece', 1::numeric, 1::numeric, 'whole'),
    ('onions', 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('basket-of-tomatoes', 'farmers_basket', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('tomatoes', 'farmers_basket', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('bell-peppers', 'kg', 1::numeric, 1::numeric, 'whole'),
    ('shombo-pepper', 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('pepper-ata-rodo', 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('carrots', 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('cucumber', 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('cabbage', 'head', 1::numeric, 1::numeric, 'whole'),
    ('broccoli', 'piece', 1::numeric, 1::numeric, 'whole'),
    ('cauliflower', 'piece', 1::numeric, 1::numeric, 'whole'),
    ('irish-potatoes', 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('sweet-potatoes', 'bag', 0.5::numeric, 0.5::numeric, 'decimal')
) as crop_defaults(slug, unit, minimum_order_quantity, quantity_step, quantity_input_type)
where public.products.slug = crop_defaults.slug
  and public.products.price > 0;

-- Extra Avocado guard for older imports where the slug was changed but the name was preserved.
update public.products
set unit = coalesce(nullif(unit, ''), 'piece'),
    minimum_order_quantity = coalesce(nullif(minimum_order_quantity, 0), 1),
    quantity_step = coalesce(nullif(quantity_step, 0), 1),
    quantity_input_type = case
      when quantity_input_type in ('whole', 'decimal') then quantity_input_type
      else 'whole'
    end,
    pricing_mode = 'fixed',
    is_orderable_online = true,
    status = 'active'::public.product_status,
    supports_home_delivery = true,
    supports_pickup_point = true,
    supports_farm_pickup = true,
    requires_delivery_confirmation = false,
    supports_wider_delivery = true,
    updated_at = now()
where lower(name) like '%avocado%'
  and price > 0;

commit;

-- After running:
--   1. Run database/backfill-universal-rates-for-existing-products.sql so every active fixed orderable product gets state/All rates.
--   2. Run database/verify-legacy-product-normalization.sql.
--   3. Review zero-price legacy products in admin before making them orderable.