-- READ-ONLY: Shields Farms launch-reset preview. This script performs no writes.
-- Run in the Shields Farms Supabase SQL editor before the execution script.

do $preview$
declare
  v_table text;
  v_reset boolean;
  v_reason text;
  v_count bigint;
  v_oldest text;
  v_newest text;
  v_time_column text;
begin
  raise notice 'table_name | current_row_count | oldest_row | newest_row | reset | reason';

  for v_table, v_reset, v_reason in
    select *
    from (values
      ('orders', true, 'test orders'),
      ('order_items', true, 'test order lines'),
      ('payments', true, 'test payment audit'),
      ('order_status_notifications', true, 'order notification history'),
      ('inventory_movements', true, 'test inventory history; product stock itself is preserved'),
      ('order_push_subscriptions', true, 'order-to-push links only'),
      ('app_notifications', true, 'operational notification history'),
      ('app_notification_reads', true, 'notification read states'),
      ('contact_inquiries', true, 'test contact and Business Supply inquiries'),
      ('marketing_campaigns', true, 'test campaigns; launch campaigns are seeded later'),
      ('marketing_campaign_clicks', true, 'test campaign clicks'),
      ('marketing_campaign_spend', true, 'test campaign spend'),
      ('marketing_prospects', true, 'test prospects'),
      ('marketing_prospect_activities', true, 'test prospect activities'),
      ('marketing_social_activities', true, 'test social activity'),
      ('affiliate_conversions', true, 'test affiliate conversions'),
      ('affiliate_clicks', true, 'test affiliate clicks'),
      ('content_post_affiliate_offers', true, 'test content-to-offer links'),
      ('affiliate_offers', true, 'test affiliate offers'),
      ('affiliate_partners', true, 'test affiliate partners'),
      ('content_product_clicks', true, 'test content click analytics'),
      ('content_subscribers', true, 'optional: reset only when v_reset_test_subscribers is true'),
      ('web_push_subscriptions', false, 'preserved by default'),
      ('products', false, 'catalogue and exact stock preserved'),
      ('product_images', false, 'product media preserved'),
      ('product_media', false, 'product media preserved'),
      ('categories', false, 'catalogue structure preserved'),
      ('delivery_zones', false, 'delivery configuration preserved'),
      ('delivery_rates', false, 'delivery configuration preserved'),
      ('product_delivery_rates', false, 'delivery configuration preserved'),
      ('app_settings', false, 'application configuration preserved'),
      ('profiles', false, 'Admin/customer profiles preserved'),
      ('content_posts', false, 'published and draft content preserved'),
      ('content_authors', false, 'content structure preserved'),
      ('content_categories', false, 'content structure preserved'),
      ('content_tags', false, 'content structure preserved'),
      ('content_sources', false, 'content structure preserved'),
      ('content_videos', false, 'content structure preserved')
    ) as scope(table_name, will_reset, reason)
  loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise notice '% | not present | not present | not present | % | %',
        v_table, v_reset, v_reason;
      continue;
    end if;

    execute format('select count(*) from public.%I', v_table) into v_count;
    select column_name into v_time_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = v_table
      and column_name in ('created_at', 'clicked_at', 'occurred_at', 'sent_at', 'spend_date', 'conversion_date', 'consented_at')
    order by array_position(array['created_at','clicked_at','occurred_at','sent_at','spend_date','conversion_date','consented_at'], column_name)
    limit 1;

    if v_time_column is null then
      v_oldest := 'n/a';
      v_newest := 'n/a';
    else
      execute format(
        'select coalesce(min(%1$I)::text, ''empty''), coalesce(max(%1$I)::text, ''empty'') from public.%2$I',
        v_time_column, v_table
      ) into v_oldest, v_newest;
    end if;

    raise notice '% | % | % | % | % | %',
      v_table, v_count, v_oldest, v_newest, v_reset, v_reason;
    v_time_column := null;
  end loop;
end
$preview$;

-- Launch reference summaries. Missing optional content tables are reported above.
select count(*) as product_count, coalesce(sum(stock_quantity), 0) as total_current_stock
from public.products;

select id, name, slug, stock_quantity
from public.products
order by name, id;

select count(*) filter (where role = 'admin') as admin_profile_count
from public.profiles;

select case when to_regclass('public.content_posts') is null then 'not present'
  else (select count(*)::text from public.content_posts) end as content_post_count;

select count(*) filter (where is_active) as active_delivery_rate_count
from public.delivery_rates;

select case when to_regclass('public.web_push_subscriptions') is null then 'not present'
  else (select count(*) filter (where enabled and revoked_at is null)::text
        from public.web_push_subscriptions) end as active_web_push_subscription_count;

-- Inspect every live FK touching a reset-scope table. Save this result with the preview.
select
  con.conname as constraint_name,
  con.conrelid::regclass::text as child_table,
  con.confrelid::regclass::text as parent_table,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.contype = 'f'
  and (
    con.conrelid = any(array[
      'public.orders'::regclass, 'public.order_items'::regclass,
      'public.payments'::regclass, 'public.order_status_notifications'::regclass,
      'public.inventory_movements'::regclass
    ])
    or con.confrelid = any(array[
      'public.orders'::regclass, 'public.order_items'::regclass,
      'public.payments'::regclass, 'public.order_status_notifications'::regclass,
      'public.inventory_movements'::regclass
    ])
    or con.conrelid::regclass::text like 'public.marketing_%'
    or con.confrelid::regclass::text like 'public.marketing_%'
    or con.conrelid::regclass::text like 'public.affiliate_%'
    or con.confrelid::regclass::text like 'public.affiliate_%'
  )
order by parent_table, child_table, constraint_name;
