insert into public.categories (name, slug, description)
values
  ('Live Chickens', 'live-chickens', 'Live poultry supplied for homes, restaurants, and events.'),
  ('Processed Birds', 'processed-birds', 'Cleaned and processed poultry ready for cooking.'),
  ('Eggs', 'eggs', 'Fresh egg packs for homes, bakeries, vendors, and resellers.'),
  ('Farm Supplies', 'farm-supplies', 'Useful farm inputs and organic growing supplies.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description;

insert into public.products (
  name,
  slug,
  description,
  category_id,
  price,
  unit,
  stock_quantity,
  minimum_order_quantity,
  status,
  available_from,
  is_featured,
  is_live_animal,
  is_processed
)
values
  (
    'Live Broiler Chicken',
    'live-broiler-chicken',
    'Healthy farm-raised broilers supplied live by weight for homes, restaurants, caterers, and bulk buyers.',
    (select id from public.categories where slug = 'live-chickens'),
    2650, 'kg', 300, 15, 'active', null, true, true, false
  ),
  (
    'Processed Whole Chicken',
    'processed-whole-chicken',
    'Cleaned whole chicken prepared for convenient cooking, retail packs, events, and catering supply.',
    (select id from public.categories where slug = 'processed-birds'),
    3650, 'kg', 90, 20, 'active', null, false, false, true
  ),
  (
    'Crate of Eggs',
    'crate-of-eggs',
    'Fresh eggs packed in crates for families, bakeries, food vendors, and resellers.',
    (select id from public.categories where slug = 'eggs'),
    5000, 'crate', 35, 5, 'active', null, false, false, false
  ),
  (
    'Half Crate of Eggs',
    'half-crate-of-eggs',
    'A smaller egg pack for households, small kitchens, and regular buyers.',
    (select id from public.categories where slug = 'eggs'),
    2500, 'half_crate', 35, 5, 'active', null, false, false, false
  ),
  (
    'Old Layers',
    'old-layers',
    'Mature layers for customers who prefer firm, flavorful birds for soups, stews, and local dishes. Available seasonally.',
    (select id from public.categories where slug = 'live-chickens'),
    8600, 'bird', 190, 10, 'coming_soon', '2026-12-01', false, true, false
  ),
  (
    'Manure',
    'manure',
    'Organic poultry manure for gardens, farms, soil improvement, and crop production.',
    (select id from public.categories where slug = 'farm-supplies'),
    1200, 'bag', 10, 3, 'active', null, false, false, false
  )
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category_id = excluded.category_id,
    price = excluded.price,
    unit = excluded.unit,
    stock_quantity = excluded.stock_quantity,
    minimum_order_quantity = excluded.minimum_order_quantity,
    status = excluded.status,
    available_from = excluded.available_from,
    is_featured = excluded.is_featured,
    is_live_animal = excluded.is_live_animal,
    is_processed = excluded.is_processed;

insert into public.delivery_zones (name, distance_km, is_active)
values
  ('Bodija', 8, true),
  ('Akobo', 12, true),
  ('Dugbe', 10, true),
  ('Challenge', 14, true),
  ('Ring Road', 13, true),
  ('Eleyele', 11, true),
  ('Moniya', 18, true),
  ('Apata', 16, true)
on conflict (name) do update
set distance_km = excluded.distance_km,
    is_active = excluded.is_active;

insert into public.app_settings (key, value)
values
  ('fuel_price_per_litre', '1325'::jsonb),
  ('vehicle_km_per_litre', '10'::jsonb),
  ('driver_flat_fee', '2000'::jsonb),
  ('use_round_trip', 'true'::jsonb),
  ('delivery_fee_rounding', '500'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
