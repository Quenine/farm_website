-- Optional Shields Farms marketing campaign presets.
-- Repeat-safe. Run only on the Shields Farms Supabase project after database/step-marketing-attribution.sql.

insert into public.marketing_campaigns (name, slug, channel, source, medium, campaign_name, content, term, target_path, is_active)
values
  ('Shields Launch WhatsApp Status', 'shields-launch-whatsapp-status', 'WhatsApp', 'whatsapp', 'organic-social', 'shields-launch', 'whatsapp-status', null, '/shop', true),
  ('Shields Food Business Outreach', 'shields-food-business-outreach', 'WhatsApp', 'whatsapp', 'direct-outreach', 'food-business-supply', 'restaurant-outreach', null, '/business-supply', true),
  ('Shields Printed Launch Flyer', 'shields-printed-launch-flyer', 'Offline', 'offline', 'qr', 'shields-launch', 'printed-flyer', null, '/shop', true),
  ('Shields Chicken Campaign', 'shields-chicken-campaign', 'WhatsApp', 'whatsapp', 'organic-social', 'hero-chicken', 'hero-product', 'chicken', '/shop?search=chicken', true),
  ('Shields Tomatoes Campaign', 'shields-tomatoes-campaign', 'WhatsApp', 'whatsapp', 'organic-social', 'hero-tomatoes', 'hero-product', 'tomatoes', '/shop?search=tomatoes', true)
on conflict (slug) do update set
  name = excluded.name,
  channel = excluded.channel,
  source = excluded.source,
  medium = excluded.medium,
  campaign_name = excluded.campaign_name,
  content = excluded.content,
  term = excluded.term,
  target_path = excluded.target_path,
  is_active = excluded.is_active,
  updated_at = now();
