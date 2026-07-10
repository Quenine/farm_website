-- Repeat-safe crop product update for Noble Farms / Shields Farms.
-- Run separately on each farm Supabase project.
-- This script does not delete products, orders, delivery rates, or product media.
-- Legacy crop products such as onions, avocado, and older generic produce slugs are left for admin review.

begin;

insert into public.categories (name, slug, description)
values ('Crop Produce', 'crop-produce', 'Fresh vegetables, tubers, tomatoes, peppers, and other produce supplied by availability.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();

with crop_category as (
  select id
  from public.categories
  where slug = 'crop-produce' or name = 'Crop Produce'
  order by (slug = 'crop-produce') desc, created_at asc
  limit 1
), incoming as (
  select *
  from (
    values
      ('Ginger - Custard Rubber', 'ginger-custard-rubber', 'Fresh ginger supplied by custard rubber for homes, kitchens, food vendors, and resale.', 35000::numeric, 'custard_rubber', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Sweet Potatoes - Bag', 'sweet-potatoes-bag', 'Fresh sweet potatoes supplied by bag for homes, kitchens, food vendors, and resale.', 45000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fixed', true, null),
      ('Sweet Potatoes - Big Paint', 'sweet-potatoes-big-paint', 'Fresh sweet potatoes supplied by big paint for smaller produce orders.', 15000::numeric, 'big_paint', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Eggplant - Bag', 'eggplant-bag', 'Fresh eggplant supplied by bag for household, restaurant, and resale orders.', 38000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fixed', true, null),
      ('Eggplant - Custard Rubber', 'eggplant-custard-rubber', 'Fresh eggplant supplied by custard rubber for smaller produce orders.', 6000::numeric, 'custard_rubber', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Beetroot - Bag', 'beetroot-bag', 'Fresh beetroot supplied by bag for homes, kitchens, and resale.', 70000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fixed', true, null),
      ('Beetroot - Bunch', 'beetroot-bunch', 'Fresh beetroot supplied by bunch.', 2000::numeric, 'bunch', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Cauliflower - Dozen', 'cauliflower-dozen', 'Fresh cauliflower supplied by dozen.', 18000::numeric, 'dozen', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Cauliflower - Piece', 'cauliflower-piece', 'Fresh cauliflower supplied per piece.', 2000::numeric, 'piece', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Broccoli - Dozen', 'broccoli-dozen', 'Fresh broccoli supplied by dozen.', 18000::numeric, 'dozen', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Broccoli - Piece', 'broccoli-piece', 'Fresh broccoli supplied per piece.', 2000::numeric, 'piece', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Cucumber - Bag', 'cucumber-bag', 'Fresh cucumber supplied by bag for homes, kitchens, and resale.', 38000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fixed', true, null),
      ('Cucumber - Rubber', 'cucumber-rubber', 'Fresh cucumber supplied by rubber for smaller produce orders.', 5000::numeric, 'rubber', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Carrots - Bag', 'carrots-bag', 'Fresh carrots supplied by bag for homes, kitchens, and resale.', 90000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fixed', true, null),
      ('Carrots - Custard Rubber', 'carrots-custard-rubber', 'Fresh carrots supplied by custard rubber for smaller produce orders.', 9000::numeric, 'custard_rubber', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Watermelon - Small', 'watermelon-small', 'Fresh small watermelon supplied per piece.', 1500::numeric, 'piece', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Watermelon - Medium', 'watermelon-medium', 'Fresh medium watermelon supplied per piece.', 2000::numeric, 'piece', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Watermelon - Large / Above', 'watermelon-large-above', 'Large watermelon and above-size watermelon supplied by confirmed availability.', 0::numeric, 'piece', 1::numeric, 1::numeric, 'whole', 'quote_required', false, 'From N2,000'),
      ('Cabbage - Small Head', 'cabbage-small-head', 'Fresh small cabbage head supplied per piece.', 1000::numeric, 'head', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Cabbage - Medium Head', 'cabbage-medium-head', 'Fresh medium cabbage head supplied per piece.', 1500::numeric, 'head', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Cabbage - Large Head', 'cabbage-large-head', 'Fresh large cabbage head supplied per piece.', 2000::numeric, 'head', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Purple Cabbage - Medium Head', 'purple-cabbage-medium-head', 'Fresh medium purple cabbage head supplied per piece.', 2500::numeric, 'head', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Purple Cabbage - Large Head', 'purple-cabbage-large-head', 'Fresh large purple cabbage head supplied per piece.', 3000::numeric, 'head', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Tomatoes - Farmers Basket', 'tomatoes-farmers-basket', 'Fresh tomatoes supplied by farmers basket for homes, food vendors, restaurants, and resale.', 40000::numeric, 'farmers_basket', 0.5::numeric, 0.5::numeric, 'decimal', 'fixed', true, null),
      ('Tomatoes - Custard Rubber', 'tomatoes-custard-rubber', 'Fresh tomatoes supplied by custard rubber for smaller produce orders.', 10000::numeric, 'custard_rubber', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Irish Potatoes - Bag', 'irish-potatoes-bag', 'Fresh Irish potatoes supplied by bag for homes, kitchens, food vendors, and resale.', 80000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fixed', true, null),
      ('Irish Potatoes - Big Rubber', 'irish-potatoes-big-rubber', 'Fresh Irish potatoes supplied by big rubber for smaller produce orders.', 20000::numeric, 'big_rubber', 1::numeric, 1::numeric, 'whole', 'fixed', true, null),
      ('Shombo - Bag', 'shombo-bag', 'Fresh Shombo pepper supplied by bag.', 150000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fixed', true, null),
      ('Tatashe - Bag', 'tatashe-bag', 'Fresh Tatashe pepper supplied by bag.', 150000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fixed', true, null),
      ('Rodo Red Pepper - Bag', 'rodo-red-pepper-bag', 'Fresh Rodo red pepper supplied by bag.', 150000::numeric, 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fixed', true, null),
      ('Bell Pepper - Kg', 'bell-pepper-kg', 'Fresh bell pepper supplied by kilogram.', 8000::numeric, 'kg', 1::numeric, 1::numeric, 'whole', 'fixed', true, null)
  ) as product_values(name, slug, description, price, unit, minimum_order_quantity, quantity_step, quantity_input_type, pricing_mode, is_orderable_online, display_price_label)
), upserted as (
  insert into public.products (
    name,
    slug,
    description,
    category_id,
    price,
    unit,
    stock_quantity,
    minimum_order_quantity,
    quantity_step,
    quantity_input_type,
    pricing_mode,
    is_orderable_online,
    display_price_label,
    delivery_class,
    delivery_unit_value,
    handling_fee,
    supports_home_delivery,
    supports_pickup_point,
    supports_farm_pickup,
    requires_delivery_confirmation,
    supports_wider_delivery,
    status,
    available_from,
    is_featured,
    is_live_animal,
    is_processed
  )
  select
    incoming.name,
    incoming.slug,
    incoming.description,
    crop_category.id,
    incoming.price,
    incoming.unit,
    case when incoming.pricing_mode = 'fixed' then 100::numeric else 0::numeric end,
    incoming.minimum_order_quantity,
    incoming.quantity_step,
    incoming.quantity_input_type,
    incoming.pricing_mode,
    incoming.is_orderable_online,
    incoming.display_price_label,
    case
      when incoming.unit in ('bag', 'big_rubber') then 'heavy_produce'
      when incoming.unit in ('farmers_basket', 'custard_rubber', 'rubber', 'head', 'piece') then 'fragile_produce'
      else 'perishable'
    end,
    1::numeric,
    0::numeric,
    true,
    true,
    true,
    false,
    true,
    'active'::public.product_status,
    null,
    false,
    false,
    false
  from incoming
  cross join crop_category
  on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      category_id = excluded.category_id,
      price = excluded.price,
      unit = excluded.unit,
      minimum_order_quantity = excluded.minimum_order_quantity,
      quantity_step = excluded.quantity_step,
      quantity_input_type = excluded.quantity_input_type,
      pricing_mode = excluded.pricing_mode,
      is_orderable_online = excluded.is_orderable_online,
      display_price_label = excluded.display_price_label,
      delivery_class = excluded.delivery_class,
      delivery_unit_value = excluded.delivery_unit_value,
      handling_fee = excluded.handling_fee,
      supports_home_delivery = true,
      supports_pickup_point = true,
      supports_farm_pickup = true,
      requires_delivery_confirmation = false,
      supports_wider_delivery = true,
      status = 'active'::public.product_status,
      available_from = null,
      is_live_animal = false,
      is_processed = false,
      updated_at = now()
  returning slug
)
update public.products
set supports_wider_delivery = true,
    supports_home_delivery = true,
    supports_pickup_point = true,
    supports_farm_pickup = true,
    requires_delivery_confirmation = false,
    updated_at = now()
where slug in (
  'basket-of-tomatoes',
  'bell-peppers',
  'shombo-pepper',
  'pepper-ata-rodo',
  'carrots',
  'cucumber',
  'cabbage'
);

commit;

-- After running, review stock, featured products, product media, and any older generic crop products in admin.