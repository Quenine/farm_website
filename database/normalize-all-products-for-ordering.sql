-- Repeat-safe all-product orderability normalization for Noble Farms / Shields Farms.
-- Run separately on each farm Supabase project.
-- This script does not delete products, orders, product media, stock records, delivery rates, or catalogue relationships.
-- It does not overwrite price, stock_quantity, descriptions, featured flags, featured sort order, category, or media.
-- Business rule: every product with price > 0 should be active, fixed-price, and orderable online.

begin;

-- Make every valid-price product checkout eligible without changing commercial values.
update public.products
set status = 'active'::public.product_status,
    pricing_mode = 'fixed',
    is_orderable_online = true,
    supports_home_delivery = true,
    supports_pickup_point = true,
    supports_farm_pickup = true,
    requires_delivery_confirmation = false,
    minimum_order_quantity = coalesce(nullif(minimum_order_quantity, 0), 1),
    quantity_step = coalesce(nullif(quantity_step, 0), 1),
    quantity_input_type = case
      when quantity_input_type in ('whole', 'decimal') then quantity_input_type
      when coalesce(nullif(quantity_step, 0), 1) <> trunc(coalesce(nullif(quantity_step, 0), 1)) then 'decimal'
      else 'whole'
    end,
    updated_at = now()
where price is not null
  and price > 0;

-- Known slug-based unit and quantity normalization. These are safe, repeatable, and skip missing slugs.
update public.products
set unit = case
      when product_defaults.preserve_unit then coalesce(nullif(public.products.unit, ''), product_defaults.unit)
      else product_defaults.unit
    end,
    minimum_order_quantity = product_defaults.minimum_order_quantity,
    quantity_step = product_defaults.quantity_step,
    quantity_input_type = product_defaults.quantity_input_type,
    updated_at = now()
from (
  values
    ('avocado', 'piece', 1::numeric, 1::numeric, 'whole', true),
    ('onions', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', false),
    ('basket-of-tomatoes', 'farmers_basket', 0.5::numeric, 0.5::numeric, 'decimal', false),
    ('tomatoes', 'farmers_basket', 0.5::numeric, 0.5::numeric, 'decimal', false),
    ('bell-peppers', 'kg', 1::numeric, 1::numeric, 'whole', false),
    ('shombo-pepper', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', false),
    ('pepper-ata-rodo', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', false),
    ('carrots', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', false),
    ('cucumber', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', false),
    ('cabbage', 'head', 1::numeric, 1::numeric, 'whole', false),
    ('broccoli', 'piece', 1::numeric, 1::numeric, 'whole', true),
    ('cauliflower', 'piece', 1::numeric, 1::numeric, 'whole', true),
    ('irish-potatoes', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', false),
    ('sweet-potatoes', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', false),
    ('crate-of-eggs', 'crate', 5::numeric, 1::numeric, 'whole', false),
    ('half-crate-of-eggs', 'half_crate', 5::numeric, 1::numeric, 'whole', false),
    ('live-broiler-chicken', 'kg', 5::numeric, 1::numeric, 'whole', false),
    ('6-week-table-size-broilers', 'kg', 5::numeric, 1::numeric, 'whole', false),
    ('processed-whole-chicken', 'kg', 5::numeric, 1::numeric, 'whole', false),
    ('old-layers', 'bird', 10::numeric, 1::numeric, 'whole', false),
    ('manure', 'bag', 3::numeric, 1::numeric, 'whole', false)
) as product_defaults(slug, unit, minimum_order_quantity, quantity_step, quantity_input_type, preserve_unit)
where public.products.slug = product_defaults.slug;

-- Extra Avocado guard for older imports where the slug changed but the name was preserved.
-- This does not force zero-price Avocado products into checkout.
update public.products
set unit = coalesce(nullif(unit, ''), 'piece'),
    minimum_order_quantity = coalesce(nullif(minimum_order_quantity, 0), 1),
    quantity_step = coalesce(nullif(quantity_step, 0), 1),
    quantity_input_type = case
      when quantity_input_type in ('whole', 'decimal') then quantity_input_type
      else 'whole'
    end,
    status = case when price > 0 then 'active'::public.product_status else status end,
    pricing_mode = case when price > 0 then 'fixed' else pricing_mode end,
    is_orderable_online = case when price > 0 then true else is_orderable_online end,
    supports_home_delivery = case when price > 0 then true else supports_home_delivery end,
    supports_pickup_point = case when price > 0 then true else supports_pickup_point end,
    supports_farm_pickup = case when price > 0 then true else supports_farm_pickup end,
    requires_delivery_confirmation = case when price > 0 then false else requires_delivery_confirmation end,
    updated_at = now()
where lower(name) like '%avocado%';

commit;

-- After running:
--   1. Run database/backfill-universal-rates-for-all-orderable-products.sql.
--   2. Run database/verify-all-products-orderable-and-rated.sql.
--   3. Set prices in admin for any products reported as needing admin price setup before making them orderable.