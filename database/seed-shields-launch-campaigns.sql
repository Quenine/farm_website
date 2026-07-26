-- Repeat-safe Shields Farms launch campaign bootstrap.
insert into public.marketing_campaigns
  (name, slug, channel, source, medium, campaign_name, content, term, target_path, is_active, starts_at, ends_at, updated_at)
values
  ('Fresh Essentials — WhatsApp', 'fresh-essentials-whatsapp', 'WhatsApp', 'whatsapp', 'organic_social', 'fresh_essentials_launch', null, null, '/shop', true, now(), null, now()),
  ('Fresh Essentials — Facebook', 'fresh-essentials-facebook', 'Facebook', 'facebook', 'organic_social', 'fresh_essentials_launch', null, null, '/shop', true, now(), null, now()),
  ('Fresh Essentials — Instagram', 'fresh-essentials-instagram', 'Instagram', 'instagram', 'organic_social', 'fresh_essentials_launch', null, null, '/shop', true, now(), null, now()),
  ('Fresh Essentials — TikTok', 'fresh-essentials-tiktok', 'TikTok', 'tiktok', 'organic_social', 'fresh_essentials_launch', null, null, '/shop', true, now(), null, now()),
  ('Fresh Essentials — X', 'fresh-essentials-x', 'X', 'x', 'organic_social', 'fresh_essentials_launch', null, null, '/shop', true, now(), null, now()),
  ('Irish Potatoes — WhatsApp', 'irish-potatoes-whatsapp', 'WhatsApp', 'whatsapp', 'organic_social', 'irish_potatoes_launch', null, null, '/shop', true, now(), null, now()),
  ('Chicken & Eggs — WhatsApp', 'chicken-eggs-whatsapp', 'WhatsApp', 'whatsapp', 'organic_social', 'chicken_eggs_launch', null, null, '/shop', true, now(), null, now()),
  ('Kitchen Essentials — WhatsApp', 'kitchen-essentials-whatsapp', 'WhatsApp', 'whatsapp', 'organic_social', 'kitchen_essentials_launch', null, null, '/shop', true, now(), null, now()),
  ('Business Supply Outreach', 'business-supply-outreach', 'Direct outreach', 'direct_outreach', 'whatsapp', 'business_supply_launch', null, null, '/business-supply', true, now(), null, now())
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
  ends_at = null,
  updated_at = now();

select name, slug, target_path,
  'https://shieldsfarms.store/go/' || slug as short_link
from public.marketing_campaigns
where slug in (
  'fresh-essentials-whatsapp','fresh-essentials-facebook',
  'fresh-essentials-instagram','fresh-essentials-tiktok','fresh-essentials-x',
  'irish-potatoes-whatsapp','chicken-eggs-whatsapp',
  'kitchen-essentials-whatsapp','business-supply-outreach'
)
order by slug;
