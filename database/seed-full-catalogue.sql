alter table public.products
  add column if not exists pricing_mode text not null default 'fixed',
  add column if not exists is_orderable_online boolean not null default true,
  add column if not exists display_price_label text;

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

insert into public.categories (name, slug, description)
values
  ('Eggs', 'eggs', 'Fresh egg packs for homes, bakeries, vendors, and resellers.'),
  ('Broilers', 'broilers', '4-week and table-size broilers supplied for scheduled orders.'),
  ('Crop Produce', 'crop-produce', 'Fresh vegetables, tubers, tomatoes, peppers, and other produce supplied by availability.'),
  ('Farm Inputs', 'farm-inputs', 'Selected farm inputs and organic growing supplies.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description;

update public.categories
set name = 'Broilers',
    description = '4-week and table-size broilers supplied for scheduled orders.'
where slug = 'live-chickens';

update public.categories
set name = 'Farm Inputs',
    description = 'Selected farm inputs and organic growing supplies.'
where slug = 'farm-supplies';

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
    (select id from public.categories where slug = 'eggs'),
    5000, 'crate', 35, 5, 'fixed', true, null, 'active', null, true, false, false
  ),
  (
    'Half Crate of Eggs',
    'half-crate-of-eggs',
    'A practical egg pack for households, small kitchens, and regular buyers.',
    (select id from public.categories where slug = 'eggs'),
    2500, 'half_crate', 35, 5, 'fixed', true, null, 'active', null, false, false, false
  ),
  (
    '4-Week Broilers',
    '4-week-broilers',
    'Young healthy broilers available for customers who want to continue rearing or purchase birds before table-size maturity.',
    (select id from public.categories where slug in ('broilers', 'live-chickens') order by slug = 'broilers' desc limit 1),
    0, 'bird', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, true, true, false
  ),
  (
    '6-Week Table-Size Broilers',
    '6-week-table-size-broilers',
    'Table-size broilers suitable for households, restaurants, caterers, food vendors, and bulk buyers.',
    (select id from public.categories where slug in ('broilers', 'live-chickens') order by slug = 'broilers' desc limit 1),
    0, 'bird', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, true, true, false
  ),
  (
    'Processed Whole Chicken',
    'processed-whole-chicken',
    'Cleaned whole chicken prepared for convenient cooking, retail supply, events, and catering.',
    (select id from public.categories where slug = 'processed-birds'),
    3650, 'kg', 90, 20, 'fixed', true, null, 'active', null, false, false, true
  ),
  (
    'Old Layers',
    'old-layers',
    'Mature birds for customers who prefer firm, flavorful chicken for soups, stews, and local dishes. Availability may be seasonal.',
    (select id from public.categories where slug in ('broilers', 'live-chickens') order by slug = 'broilers' desc limit 1),
    8600, 'bird', 190, 10, 'fixed', true, null, 'coming_soon', '2026-12-01', false, true, false
  ),
  (
    'Irish Potatoes', 'irish-potatoes',
    'Fresh Irish potatoes suitable for homes, restaurants, food vendors, and bulk kitchen supply.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Bell Peppers', 'bell-peppers',
    'Fresh bell peppers supplied for cooking, food prep, restaurants, caterers, and resale.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Onions', 'onions',
    'Fresh onions available for household cooking, food vendors, restaurants, and bulk buyers.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Sweet Potatoes', 'sweet-potatoes',
    'Nutritious sweet potatoes supplied for homes, kitchens, food vendors, and resellers.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Pepper (Ata Rodo)', 'pepper-ata-rodo',
    'Fresh Ata Rodo pepper for cooking, sauces, soups, stews, and food business supply.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Carrots', 'carrots',
    'Fresh carrots suitable for meals, salads, juice preparation, restaurants, and produce resale.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Cabbage', 'cabbage',
    'Fresh cabbage for homes, restaurants, caterers, salads, and bulk produce buyers.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Broccoli', 'broccoli',
    'Fresh broccoli supplied for homes, healthy meals, restaurants, and produce buyers.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Avocado', 'avocado',
    'Fresh avocados available for homes, food vendors, restaurants, and healthy meal preparation.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Cucumber', 'cucumber',
    'Fresh cucumbers suitable for salads, meals, juice preparation, restaurants, and resale.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Shombo Pepper', 'shombo-pepper',
    'Fresh Shombo pepper for stews, sauces, soups, and local food preparation.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Cauliflower', 'cauliflower',
    'Fresh cauliflower supplied for homes, restaurants, healthy meals, and produce buyers.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'unit', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Basket of Tomatoes', 'basket-of-tomatoes',
    'Fresh tomatoes supplied by basket for homes, food vendors, restaurants, caterers, and market resellers.',
    (select id from public.categories where slug = 'crop-produce'),
    0, 'basket', 0, 1, 'quote_required', false, 'Check Availability', 'active', null, false, false, false
  ),
  (
    'Manure',
    'manure',
    'Organic poultry manure for gardens, farms, soil improvement, and crop production.',
    (select id from public.categories where slug in ('farm-inputs', 'farm-supplies') order by slug = 'farm-inputs' desc limit 1),
    1200, 'bag', 10, 3, 'fixed', true, null, 'active', null, false, false, false
  )
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category_id = excluded.category_id,
    pricing_mode = case
      when public.products.slug in (
        '4-week-broilers', '6-week-table-size-broilers', 'irish-potatoes',
        'bell-peppers', 'onions', 'sweet-potatoes', 'pepper-ata-rodo',
        'carrots', 'cabbage', 'broccoli', 'avocado', 'cucumber',
        'shombo-pepper', 'cauliflower', 'basket-of-tomatoes'
      ) then 'quote_required'
      else public.products.pricing_mode
    end,
    is_orderable_online = case
      when public.products.slug in (
        '4-week-broilers', '6-week-table-size-broilers', 'irish-potatoes',
        'bell-peppers', 'onions', 'sweet-potatoes', 'pepper-ata-rodo',
        'carrots', 'cabbage', 'broccoli', 'avocado', 'cucumber',
        'shombo-pepper', 'cauliflower', 'basket-of-tomatoes'
      ) then false
      else public.products.is_orderable_online
    end,
    display_price_label = case
      when public.products.slug in (
        '4-week-broilers', '6-week-table-size-broilers', 'irish-potatoes',
        'bell-peppers', 'onions', 'sweet-potatoes', 'pepper-ata-rodo',
        'carrots', 'cabbage', 'broccoli', 'avocado', 'cucumber',
        'shombo-pepper', 'cauliflower', 'basket-of-tomatoes'
      ) then 'Check Availability'
      else public.products.display_price_label
    end,
    price = case
      when public.products.slug in (
        '4-week-broilers', '6-week-table-size-broilers', 'irish-potatoes',
        'bell-peppers', 'onions', 'sweet-potatoes', 'pepper-ata-rodo',
        'carrots', 'cabbage', 'broccoli', 'avocado', 'cucumber',
        'shombo-pepper', 'cauliflower', 'basket-of-tomatoes'
      ) then public.products.price
      else public.products.price
    end;
