alter table public.products
  add column if not exists pricing_mode text not null default 'fixed',
  add column if not exists is_orderable_online boolean not null default true,
  add column if not exists quantity_step numeric(12, 2) not null default 1,
  add column if not exists quantity_input_type text not null default 'whole',
  add column if not exists display_price_label text,
  add column if not exists delivery_class text not null default 'standard',
  add column if not exists delivery_unit_value numeric(12, 2) not null default 1,
  add column if not exists handling_fee numeric(12, 2) not null default 0,
  add column if not exists supports_home_delivery boolean not null default true,
  add column if not exists supports_pickup_point boolean not null default true,
  add column if not exists supports_farm_pickup boolean not null default true,
  add column if not exists requires_delivery_confirmation boolean not null default false,
  add column if not exists featured_sort_order integer not null default 100,
  add column if not exists supports_wider_delivery boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_pricing_mode_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_pricing_mode_check
      check (pricing_mode in ('fixed', 'quote_required'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_quote_orderable_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_quote_orderable_check
      check (pricing_mode = 'fixed' or is_orderable_online = false);
  end if;
end $$;
create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  url text not null,
  storage_path text,
  alt_text text,
  caption text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_media_product_id_sort_idx
  on public.product_media(product_id, sort_order);

create unique index if not exists product_media_one_primary_image_uidx
  on public.product_media(product_id)
  where is_primary = true and media_type = 'image';

do $$
begin
  if to_regclass('public.product_images') is not null then
    insert into public.product_media (
      product_id, media_type, url, alt_text, sort_order, is_primary, created_at
    )
    select product_id, 'image', image_url, alt_text, sort_order, sort_order = 0, created_at
    from public.product_images image_source
    where not exists (
      select 1
      from public.product_media existing
      where existing.product_id = image_source.product_id
        and existing.url = image_source.image_url
    );
  end if;
end $$;

insert into public.categories (name, slug, description)
select name, slug, description
from (
  values
    ('Eggs', 'eggs', 'Fresh egg packs for homes, bakeries, vendors, and resellers.'),
    ('Broilers', 'broilers', '4-week and table-size broilers supplied for scheduled orders.'),
    ('Processed Birds', 'processed-birds', 'Cleaned and processed poultry ready for cooking.'),
    ('Crop Produce', 'crop-produce', 'Fresh vegetables, tubers, tomatoes, peppers, and other produce supplied by availability.'),
    ('Farm Inputs', 'farm-inputs', 'Selected farm inputs and organic growing supplies.')
) as incoming(name, slug, description)
where not exists (
  select 1
  from public.categories existing
  where existing.slug = incoming.slug
     or existing.name = incoming.name
);

insert into public.products (
  name,
  slug,
  description,
  category_id,
  price,
  unit,
  stock_quantity,
  minimum_order_quantity,
  pricing_mode,
  is_orderable_online,
  display_price_label,
  status,
  available_from,
  is_featured,
  is_live_animal,
  is_processed
)
values
  (
    'Crate of Eggs',
    'crate-of-eggs',
    'Fresh eggs packed in crates for homes, bakeries, food vendors, restaurants, and resellers.',
    (select id from public.categories where slug = 'eggs' or name = 'Eggs' order by (slug = 'eggs') desc, created_at asc limit 1),
    5000, 'crate', 35, 5, 'fixed', true, null, 'active', null, true, false, false
  ),
  (
    'Half Crate of Eggs',
    'half-crate-of-eggs',
    'A practical egg pack for households, small kitchens, and regular buyers.',
    (select id from public.categories where slug = 'eggs' or name = 'Eggs' order by (slug = 'eggs') desc, created_at asc limit 1),
    2500, 'half_crate', 35, 5, 'fixed', true, null, 'active', null, false, false, false
  ),
  (
    '4-Week Broilers',
    '4-week-broilers',
    'Young healthy broilers available for customers who want to continue rearing or purchase birds before table-size maturity.',
    (select id from public.categories where slug in ('broilers', 'live-chickens') or name = 'Broilers' order by (slug = 'broilers') desc, created_at asc limit 1),
    0, 'bird', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, true, true, false
  ),
  (
    '6-Week Table-Size Broilers',
    '6-week-table-size-broilers',
    'Table-size broilers suitable for households, restaurants, caterers, food vendors, and bulk buyers.',
    (select id from public.categories where slug in ('broilers', 'live-chickens') or name = 'Broilers' order by (slug = 'broilers') desc, created_at asc limit 1),
    0, 'bird', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, true, true, false
  ),
  (
    'Processed Whole Chicken',
    'processed-whole-chicken',
    'Cleaned whole chicken prepared for convenient cooking, retail supply, events, and catering.',
    (select id from public.categories where slug = 'processed-birds' or name = 'Processed Birds' order by (slug = 'processed-birds') desc, created_at asc limit 1),
    3650, 'kg', 90, 20, 'fixed', true, null, 'active', null, false, false, true
  ),
  (
    'Old Layers',
    'old-layers',
    'Mature birds for customers who prefer firm, flavorful chicken for soups, stews, and local dishes. Availability may be seasonal.',
    (select id from public.categories where slug in ('broilers', 'live-chickens') or name = 'Broilers' order by (slug = 'broilers') desc, created_at asc limit 1),
    8600, 'bird', 190, 10, 'fixed', true, null, 'coming_soon', '2026-12-01', false, true, false
  ),
  (
    'Irish Potatoes', 'irish-potatoes',
    'Fresh Irish potatoes suitable for homes, restaurants, food vendors, and bulk kitchen supply.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Bell Peppers', 'bell-peppers',
    'Fresh bell peppers supplied for cooking, food prep, restaurants, caterers, and resale.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Onions', 'onions',
    'Fresh onions available for household cooking, food vendors, restaurants, and bulk buyers.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Sweet Potatoes', 'sweet-potatoes',
    'Nutritious sweet potatoes supplied for homes, kitchens, food vendors, and resellers.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Pepper (Ata Rodo)', 'pepper-ata-rodo',
    'Fresh Ata Rodo pepper for cooking, sauces, soups, stews, and food business supply.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Carrots', 'carrots',
    'Fresh carrots suitable for meals, salads, juice preparation, restaurants, and produce resale.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Cabbage', 'cabbage',
    'Fresh cabbage for homes, restaurants, caterers, salads, and bulk produce buyers.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Broccoli', 'broccoli',
    'Fresh broccoli supplied for homes, healthy meals, restaurants, and produce buyers.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Avocado', 'avocado',
    'Fresh avocados available for homes, food vendors, restaurants, and healthy meal preparation.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Cucumber', 'cucumber',
    'Fresh cucumbers suitable for salads, meals, juice preparation, restaurants, and resale.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Shombo Pepper', 'shombo-pepper',
    'Fresh Shombo pepper for stews, sauces, soups, and local food preparation.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Cauliflower', 'cauliflower',
    'Fresh cauliflower supplied for homes, restaurants, healthy meals, and produce buyers.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Basket of Tomatoes', 'basket-of-tomatoes',
    'Fresh tomatoes supplied by basket for homes, food vendors, restaurants, caterers, and market resellers.',
    (select id from public.categories where slug = 'crop-produce' or name = 'Crop Produce' order by (slug = 'crop-produce') desc, created_at asc limit 1),
    0, 'basket', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Manure',
    'manure',
    'Organic poultry manure for gardens, farms, soil improvement, and crop production.',
    (select id from public.categories where slug in ('farm-inputs', 'farm-supplies') or name = 'Farm Inputs' order by (slug = 'farm-inputs') desc, created_at asc limit 1),
    1200, 'bag', 10, 3, 'fixed', true, null, 'active', null, false, false, false
  )
on conflict (slug) do nothing;


update public.products
set supports_wider_delivery = true
where slug in (
  'irish-potatoes', 'bell-peppers', 'onions', 'sweet-potatoes',
  'pepper-ata-rodo', 'carrots', 'cabbage', 'broccoli', 'avocado',
  'cucumber', 'shombo-pepper', 'cauliflower', 'basket-of-tomatoes'
);

update public.products
set unit = product_defaults.unit,
    minimum_order_quantity = product_defaults.minimum_order_quantity,
    quantity_step = product_defaults.quantity_step,
    quantity_input_type = product_defaults.quantity_input_type,
    delivery_class = product_defaults.delivery_class,
    delivery_unit_value = product_defaults.delivery_unit_value,
    handling_fee = product_defaults.handling_fee,
    supports_home_delivery = true,
    supports_pickup_point = true,
    supports_farm_pickup = true,
    requires_delivery_confirmation = false
from (
  values
    ('crate-of-eggs', 'crate', 5::numeric, 1::numeric, 'whole', 'fragile', 1::numeric, 500::numeric),
    ('half-crate-of-eggs', 'half_crate', 5::numeric, 1::numeric, 'whole', 'fragile', 0.5::numeric, 300::numeric),
    ('basket-of-tomatoes', 'basket', 0.5::numeric, 0.5::numeric, 'decimal', 'fragile_produce', 1::numeric, 1000::numeric),
    ('onions', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'heavy_produce', 1::numeric, 0::numeric),
    ('irish-potatoes', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'heavy_produce', 1.5::numeric, 0::numeric),
    ('sweet-potatoes', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'heavy_produce', 1.5::numeric, 0::numeric),
    ('bell-peppers', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fragile_produce', 1::numeric, 700::numeric),
    ('pepper-ata-rodo', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'perishable', 1::numeric, 500::numeric),
    ('shombo-pepper', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'perishable', 1::numeric, 500::numeric),
    ('carrots', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'perishable', 1::numeric, 300::numeric),
    ('cabbage', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'perishable', 1::numeric, 300::numeric),
    ('broccoli', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'perishable', 1::numeric, 500::numeric),
    ('avocado', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fragile_produce', 1::numeric, 700::numeric),
    ('cucumber', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'fragile_produce', 1::numeric, 500::numeric),
    ('cauliflower', 'bag', 0.5::numeric, 0.5::numeric, 'decimal', 'perishable', 1::numeric, 500::numeric),
    ('6-week-table-size-broilers', 'kg', 5::numeric, 1::numeric, 'whole', 'fresh_food', 0.05::numeric, 300::numeric),
    ('live-broiler-chicken', 'kg', 5::numeric, 1::numeric, 'whole', 'fresh_food', 0.05::numeric, 300::numeric),
    ('processed-whole-chicken', 'kg', 5::numeric, 1::numeric, 'whole', 'fresh_food', 0.05::numeric, 200::numeric),
    ('old-layers', 'bird', 10::numeric, 1::numeric, 'whole', 'live_animal', 1::numeric, 500::numeric),
    ('manure', 'bag', 3::numeric, 1::numeric, 'whole', 'bulky_farm_input', 2.5::numeric, 1500::numeric)
 ) as product_defaults(slug, unit, minimum_order_quantity, quantity_step, quantity_input_type, delivery_class, delivery_unit_value, handling_fee)
where public.products.slug = product_defaults.slug;

