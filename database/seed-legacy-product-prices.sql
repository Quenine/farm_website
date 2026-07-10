-- Repeat-safe legacy product price seed for Noble Farms / Shields Farms.
-- Run after database/seed-updated-crop-products.sql and before universal delivery-rate backfill.
-- This script does not delete products, product media, orders, stock records, or delivery-rate overrides.
-- Business rule: every product should be active, fixed-price, orderable, and delivery-enabled for now.
-- Confirmed legacy prices are applied first; products still missing a valid price receive a safe placeholder price.

begin;

-- Confirmed legacy prices.
update public.products
set name = legacy_prices.name,
    price = legacy_prices.price,
    unit = legacy_prices.unit,
    minimum_order_quantity = legacy_prices.minimum_order_quantity,
    quantity_step = legacy_prices.quantity_step,
    quantity_input_type = legacy_prices.quantity_input_type,
    pricing_mode = 'fixed',
    is_orderable_online = true,
    status = 'active'::public.product_status,
    supports_home_delivery = true,
    supports_pickup_point = true,
    supports_farm_pickup = true,
    requires_delivery_confirmation = false,
    updated_at = now()
from (
  values
    ('basket-of-tomatoes', 'Basket of Tomatoes', 40000::numeric, 'farmers_basket', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('bell-peppers', 'Bell Peppers', 8000::numeric, 'kg', 1::numeric, 1::numeric, 'whole'),
    ('carrots', 'Carrots', 90000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('cucumber', 'Cucumber', 38000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('irish-potatoes', 'Irish Potatoes', 80000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('sweet-potatoes', 'Sweet Potatoes', 45000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('shombo-pepper', 'Shombo Pepper', 150000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('pepper-ata-rodo', 'Pepper (Ata Rodo)', 150000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('cabbage', 'Cabbage', 1500::numeric, 'head', 1::numeric, 1::numeric, 'whole'),
    ('broccoli', 'Broccoli', 2000::numeric, 'piece', 1::numeric, 1::numeric, 'whole'),
    ('cauliflower', 'Cauliflower', 2000::numeric, 'piece', 1::numeric, 1::numeric, 'whole')
) as legacy_prices(slug, name, price, unit, minimum_order_quantity, quantity_step, quantity_input_type)
where public.products.slug = legacy_prices.slug;

-- Placeholder prices for previously unresolved products.
update public.products
set name = placeholder_prices.name,
    price = placeholder_prices.price,
    unit = placeholder_prices.unit,
    minimum_order_quantity = placeholder_prices.minimum_order_quantity,
    quantity_step = placeholder_prices.quantity_step,
    quantity_input_type = placeholder_prices.quantity_input_type,
    pricing_mode = 'fixed',
    is_orderable_online = true,
    status = 'active'::public.product_status,
    supports_home_delivery = true,
    supports_pickup_point = true,
    supports_farm_pickup = true,
    requires_delivery_confirmation = false,
    updated_at = now()
from (
  values
    ('avocado', 'Avocado', 5000::numeric, 'piece', 1::numeric, 1::numeric, 'whole'),
    ('onions', 'Onions', 120000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal'),
    ('4-week-broilers', '4-Week Broilers', 4500::numeric, 'bird', 10::numeric, 1::numeric, 'whole'),
    ('6-week-table-size-broilers', '6-Week Table-Size Broilers', 6500::numeric, 'bird', 5::numeric, 1::numeric, 'whole'),
    ('watermelon-large-above', 'Watermelon - Large / Above', 3000::numeric, 'piece', 1::numeric, 1::numeric, 'whole')
) as placeholder_prices(slug, name, price, unit, minimum_order_quantity, quantity_step, quantity_input_type)
where public.products.slug = placeholder_prices.slug;

-- Catch-all safety pass: any remaining product that is zero-priced, quote-required, or not orderable
-- gets a safe placeholder price unless it already has a better positive price.
update public.products
set price = case when price is null or price <= 0 then 1000::numeric else price end,
    pricing_mode = 'fixed',
    is_orderable_online = true,
    status = 'active'::public.product_status,
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
where price is null
   or price <= 0
   or pricing_mode <> 'fixed'
   or is_orderable_online is not true
   or status <> 'active';

commit;

-- After running:
--   1. Run database/backfill-universal-rates-for-all-orderable-products.sql.
--   2. Run database/verify-all-products-orderable-and-rated.sql.
-- Admin should review placeholder prices before public launch and update them where needed.