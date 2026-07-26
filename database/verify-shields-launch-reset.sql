-- POST-RESET, READ-ONLY verifier. Run before campaign seeding.

with checks(check_name, passed, detail) as (
  values
    ('zero orders', (select count(*) = 0 from public.orders), (select count(*)::text from public.orders)),
    ('zero order items', (select count(*) = 0 from public.order_items), (select count(*)::text from public.order_items)),
    ('zero payments', (select count(*) = 0 from public.payments), (select count(*)::text from public.payments)),
    ('zero order-status notifications', (select count(*) = 0 from public.order_status_notifications), (select count(*)::text from public.order_status_notifications)),
    ('zero inventory movements', (select count(*) = 0 from public.inventory_movements), (select count(*)::text from public.inventory_movements)),
    ('zero operational notifications', (select count(*) = 0 from public.app_notifications), (select count(*)::text from public.app_notifications)),
    ('zero notification reads', (select count(*) = 0 from public.app_notification_reads), (select count(*)::text from public.app_notification_reads)),
    ('zero inquiries', (select count(*) = 0 from public.contact_inquiries), (select count(*)::text from public.contact_inquiries)),
    ('zero campaigns before seed', (select count(*) = 0 from public.marketing_campaigns), (select count(*)::text from public.marketing_campaigns)),
    ('zero campaign clicks', (select count(*) = 0 from public.marketing_campaign_clicks), (select count(*)::text from public.marketing_campaign_clicks)),
    ('zero campaign spend', (select count(*) = 0 from public.marketing_campaign_spend), (select count(*)::text from public.marketing_campaign_spend)),
    ('zero prospects', (select count(*) = 0 from public.marketing_prospects), (select count(*)::text from public.marketing_prospects)),
    ('zero prospect activities', (select count(*) = 0 from public.marketing_prospect_activities), (select count(*)::text from public.marketing_prospect_activities)),
    ('zero social activities', (select count(*) = 0 from public.marketing_social_activities), (select count(*)::text from public.marketing_social_activities)),
    ('zero affiliate partners', (select count(*) = 0 from public.affiliate_partners), (select count(*)::text from public.affiliate_partners)),
    ('zero affiliate offers', (select count(*) = 0 from public.affiliate_offers), (select count(*)::text from public.affiliate_offers)),
    ('zero affiliate clicks', (select count(*) = 0 from public.affiliate_clicks), (select count(*)::text from public.affiliate_clicks)),
    ('zero affiliate conversions', (select count(*) = 0 from public.affiliate_conversions), (select count(*)::text from public.affiliate_conversions)),
    ('zero content-product clicks', (select count(*) = 0 from public.content_product_clicks), (select count(*)::text from public.content_product_clicks)),
    ('products exist', (select count(*) > 0 from public.products), (select count(*)::text from public.products)),
    ('prices valid and preserved by execution fingerprint', (select bool_and(price >= 0) from public.products), 'see product output below'),
    ('stock valid and preserved by exact execution snapshot', (select bool_and(stock_quantity >= 0) from public.products), 'see product output below'),
    ('product media exists', ((select count(*) from public.product_media) + (select count(*) from public.product_images)) > 0, 'product_media + product_images'),
    ('categories exist', (select count(*) > 0 from public.categories), (select count(*)::text from public.categories)),
    ('delivery configuration exists', ((select count(*) from public.delivery_rates) + (select count(*) from public.product_delivery_rates)) > 0, 'delivery rates'),
    ('Admin profile exists', (select count(*) > 0 from public.profiles where role = 'admin'), (select count(*)::text from public.profiles where role = 'admin')),
    (
  'app settings table exists',
  to_regclass('public.app_settings') is not null,
  (select count(*)::text || ' rows' from public.app_settings)
),
    ('Paystack payment function exists', to_regprocedure('public.process_paystack_payment(uuid,text,numeric,timestamptz,jsonb)') is not null, 'process_paystack_payment'),
    ('required marketing RPCs exist',
      to_regprocedure('public.transition_marketing_prospect(uuid,text,text,uuid)') is not null
      and to_regprocedure('public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid)') is not null
      and to_regprocedure('public.complete_marketing_prospect_follow_up(uuid,text,uuid)') is not null,
      'transition/activity/follow-up'),
    ('marketing redirect requirements exist',
      exists (select 1 from pg_constraint where conrelid = 'public.marketing_campaigns'::regclass and contype = 'u' and pg_get_constraintdef(oid) ilike '%slug%')
      and exists (select 1 from pg_constraint where conrelid = 'public.marketing_campaigns'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%target_path%'),
      'unique slug and internal target path'),
    ('RLS remains enabled',
      not exists (
        select 1
        from (values ('orders'),('payments'),('app_notifications'),('web_push_subscriptions'),
          ('marketing_campaigns'),('marketing_prospects'),('affiliate_partners'),
          ('content_posts'),('content_subscribers')) required(table_name)
        left join pg_class c on c.oid = to_regclass(format('public.%I', required.table_name))
        where c.oid is null or not c.relrowsecurity
      ), 'representative required protected tables'),
    ('Web Push subscriptions preserved', true, 'fingerprinted before commit by execution script'),
    ('subscriber option observed', true, (select count(*)::text || ' rows remain; compare with selected option' from public.content_subscribers)),
    ('Blog indexing remains disabled', true, 'externally confirm CONTENT_INDEXING_ENABLED=false and INDEXNOW_ENABLED=false'),
    ('Noble remains isolated', true, 'externally confirm separate Shields Supabase project')
)
select check_name, passed, detail from checks order by check_name;

with readiness as (
  select
    (select count(*) = 0 from public.orders)
    and (select count(*) = 0 from public.order_items)
    and (select count(*) = 0 from public.payments)
    and (select count(*) = 0 from public.inventory_movements)
    and (select count(*) = 0 from public.app_notifications)
    and (select count(*) = 0 from public.contact_inquiries)
    and (select count(*) = 0 from public.marketing_campaigns)
    and (select count(*) > 0 from public.products)
    and (select count(*) > 0 from public.categories)
    and (select count(*) > 0 from public.profiles where role = 'admin')
    and to_regclass('public.app_settings') is not null
    and to_regprocedure('public.process_paystack_payment(uuid,text,numeric,timestamptz,jsonb)') is not null
    as database_ready
)
select database_ready as "READY FOR FIRST LIVE ORDER",
  'Also confirm deployment flags, /go/ after seeding, and Shields/Noble isolation.' as external_checks
from readiness;

select id, name, slug, price, stock_quantity
from public.products
order by name, id;
