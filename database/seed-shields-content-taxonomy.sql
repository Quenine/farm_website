-- Shields Farms content taxonomy seed.
-- Run only after database/step-content-affiliate-publisher.sql in the Shields Farms Supabase project.
-- Does not seed fake posts, reviews, authors or affiliate offers.

insert into public.content_categories (name, slug, description, sort_order)
values
  ('Poultry Farming', 'poultry-farming', 'Broiler, layer, egg, housing, health and poultry business guides.', 10),
  ('Crop Production', 'crop-production', 'Practical crop production and produce-supply guides.', 20),
  ('Farm Tools and Equipment', 'farm-tools-and-equipment', 'Equipment, tools and farm operations resources.', 30),
  ('Agribusiness and Farm Finance', 'agribusiness-and-farm-finance', 'Business planning, pricing, margins and finance context.', 40),
  ('Food Storage and Processing', 'food-storage-and-processing', 'Post-harvest, storage, handling and processing guides.', 50),
  ('Buying Guides and Reviews', 'buying-guides-and-reviews', 'Editorial buying guides, comparisons and researched recommendations.', 60),
  ('Farm Technology', 'farm-technology', 'Useful farm technology and digital operations topics.', 70),
  ('Market and Supply Insights', 'market-and-supply-insights', 'Market, supply and buyer insight content.', 80),
  ('Shields Farms Updates', 'shields-farms-updates', 'Field notes and operational updates from Shields Farms.', 90)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.content_tags (name, slug, description)
values
  ('Broiler Farming', 'broiler-farming', null),
  ('Egg Production', 'egg-production', null),
  ('Tomatoes', 'tomatoes', null),
  ('Pepper', 'pepper', null),
  ('Irish Potatoes', 'irish-potatoes', null),
  ('Bell Peppers', 'bell-peppers', null),
  ('Poultry Feeders', 'poultry-feeders', null),
  ('Poultry Drinkers', 'poultry-drinkers', null),
  ('Farm Weighing Scales', 'farm-weighing-scales', null),
  ('Irrigation Tools', 'irrigation-tools', null),
  ('Packaging Equipment', 'packaging-equipment', null),
  ('Food Business', 'food-business', null),
  ('Agribusiness Nigeria', 'agribusiness-nigeria', null),
  ('Smallholder Farming', 'smallholder-farming', null),
  ('Farm Management', 'farm-management', null),
  ('Post-Harvest Storage', 'post-harvest-storage', null)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true;
