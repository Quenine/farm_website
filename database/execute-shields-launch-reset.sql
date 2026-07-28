-- DESTRUCTIVE, ONE-TIME SHIELDS FARMS LAUNCH RESET.
-- Expected confirmation value: RESET_SHIELDS_FARMS_LAUNCH_2026_07_26
-- Leave REPLACE_ME unchanged until the preview and backup have been reviewed.

begin;

do $guard$
declare
  v_confirmation text := 'RESET_SHIELDS_FARMS_LAUNCH_2026_07_26';
  v_reset_test_subscribers boolean := true; -- OPTION: false preserves subscribers.
begin
  if v_confirmation <> 'RESET_SHIELDS_FARMS_LAUNCH_2026_07_26' then
    raise exception 'Reset refused: replace REPLACE_ME with the exact confirmation value';
  end if;
  perform set_config('shields.reset_test_subscribers', v_reset_test_subscribers::text, true);
end
$guard$;

-- Snapshots are transaction-local and are created before any deletion.
create temporary table shields_stock_snapshot on commit drop as
select id, stock_quantity from public.products;

create temporary table shields_preserved_snapshot (
  table_name text primary key,
  row_count bigint not null,
  row_fingerprint text not null
) on commit drop;

do $snapshot$
declare
  v_table text;
  v_count bigint;
  v_fingerprint text;
begin
  foreach v_table in array array[
    'products','categories','product_images','product_media','delivery_zones',
    'delivery_rates','product_delivery_rates','app_settings','profiles',
    'content_posts','content_authors','content_categories','content_tags',
    'content_sources','content_videos','web_push_subscriptions'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Required preserved table public.% is not present', v_table;
    end if;
    execute format(
      'select count(*), md5(coalesce(string_agg(row_to_json(t)::text, '''' order by row_to_json(t)::text), '''')) from public.%I t',
      v_table
    ) into v_count, v_fingerprint;
    insert into shields_preserved_snapshot values (v_table, v_count, v_fingerprint);
  end loop;
end
$snapshot$;

-- Reject live FK dependencies not covered by the reviewed deletion scope.
do $foreign_key_guard$
declare
  v_unexpected text;
begin
  select string_agg(format('%s: %s -> %s', conname, conrelid::regclass, confrelid::regclass), E'\n')
  into v_unexpected
  from pg_constraint
  where contype = 'f'
    and confrelid = any(array[
      'public.orders'::regclass,
      'public.order_items'::regclass,
      'public.app_notifications'::regclass,
      'public.marketing_campaigns'::regclass,
      'public.marketing_prospects'::regclass,
      'public.affiliate_partners'::regclass,
      'public.affiliate_offers'::regclass
    ])
    and conrelid <> all(array[
      'public.order_push_subscriptions'::regclass,
      'public.order_status_notifications'::regclass,
      'public.payments'::regclass,
      'public.inventory_movements'::regclass,
      'public.order_items'::regclass,
      'public.app_notification_reads'::regclass,
      'public.marketing_prospect_activities'::regclass,
      'public.marketing_prospects'::regclass,
      'public.marketing_social_activities'::regclass,
      'public.marketing_campaign_spend'::regclass,
      'public.marketing_campaign_clicks'::regclass,
      'public.affiliate_conversions'::regclass,
      'public.affiliate_clicks'::regclass,
      'public.content_post_affiliate_offers'::regclass,
      'public.affiliate_offers'::regclass
    ]);
  if v_unexpected is not null then
    raise exception 'Reset refused: unexpected foreign-key dependencies:%', E'\n' || v_unexpected;
  end if;
end
$foreign_key_guard$;

create temporary table shields_reset_summary (
  sequence_no integer generated always as identity,
  table_name text not null,
  deleted_rows bigint not null
) on commit drop;

-- Explicit child-before-parent deletion order. No cascade is relied upon.
with deleted as (delete from public.order_push_subscriptions returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'order_push_subscriptions', count(*) from deleted;
with deleted as (delete from public.order_status_notifications returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'order_status_notifications', count(*) from deleted;
with deleted as (delete from public.payments returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'payments', count(*) from deleted;
with deleted as (delete from public.inventory_movements returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'inventory_movements', count(*) from deleted;
with deleted as (delete from public.order_items returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'order_items', count(*) from deleted;
with deleted as (delete from public.orders returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'orders', count(*) from deleted;

with deleted as (delete from public.app_notification_reads returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'app_notification_reads', count(*) from deleted;
with deleted as (delete from public.app_notifications returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'app_notifications', count(*) from deleted;

with deleted as (delete from public.marketing_prospect_activities returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'marketing_prospect_activities', count(*) from deleted;
with deleted as (delete from public.marketing_prospects returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'marketing_prospects', count(*) from deleted;
with deleted as (delete from public.marketing_social_activities returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'marketing_social_activities', count(*) from deleted;
with deleted as (delete from public.marketing_campaign_spend returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'marketing_campaign_spend', count(*) from deleted;
with deleted as (delete from public.marketing_campaign_clicks returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'marketing_campaign_clicks', count(*) from deleted;
with deleted as (delete from public.marketing_campaigns returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'marketing_campaigns', count(*) from deleted;

with deleted as (delete from public.affiliate_conversions returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'affiliate_conversions', count(*) from deleted;
with deleted as (delete from public.affiliate_clicks returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'affiliate_clicks', count(*) from deleted;
with deleted as (delete from public.content_post_affiliate_offers returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'content_post_affiliate_offers', count(*) from deleted;
with deleted as (delete from public.affiliate_offers returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'affiliate_offers', count(*) from deleted;
with deleted as (delete from public.affiliate_partners returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'affiliate_partners', count(*) from deleted;

with deleted as (delete from public.content_product_clicks returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'content_product_clicks', count(*) from deleted;
with deleted as (delete from public.contact_inquiries returning 1)
insert into shields_reset_summary(table_name, deleted_rows) select 'contact_inquiries', count(*) from deleted;

do $subscribers$
declare v_count bigint := 0;
begin
  if current_setting('shields.reset_test_subscribers')::boolean then
    delete from public.content_subscribers;
    get diagnostics v_count = row_count;
  end if;
  insert into shields_reset_summary(table_name, deleted_rows)
  values ('content_subscribers', v_count);
end
$subscribers$;

-- Stock and every protected table must be byte-for-byte equivalent as JSON rows.
do $verify$
declare
  v_table text;
  v_before_count bigint;
  v_before_fingerprint text;
  v_after_count bigint;
  v_after_fingerprint text;
begin
  if exists (
    (select id, stock_quantity from shields_stock_snapshot
     except select id, stock_quantity from public.products)
    union all
    (select id, stock_quantity from public.products
     except select id, stock_quantity from shields_stock_snapshot)
  ) then
    raise exception 'Reset rolled back: products.stock_quantity changed';
  end if;

  for v_table, v_before_count, v_before_fingerprint in
    select table_name, row_count, row_fingerprint from shields_preserved_snapshot
  loop
    execute format(
      'select count(*), md5(coalesce(string_agg(row_to_json(t)::text, '''' order by row_to_json(t)::text), '''')) from public.%I t',
      v_table
    ) into v_after_count, v_after_fingerprint;
    if (v_after_count, v_after_fingerprint) is distinct from (v_before_count, v_before_fingerprint) then
      raise exception 'Reset rolled back: protected table public.% changed', v_table;
    end if;
  end loop;
end
$verify$;

-- This result is returned before COMMIT. Any unexpected error above aborts the transaction.
select sequence_no, table_name, deleted_rows
from shields_reset_summary
order by sequence_no;

select
  (select count(*) from public.products) as preserved_products,
  (select coalesce(sum(stock_quantity), 0) from public.products) as preserved_total_stock,
  (select count(*) from public.profiles where role = 'admin') as preserved_admin_profiles,
  (select count(*) from public.web_push_subscriptions) as preserved_web_push_subscriptions,
  current_setting('shields.reset_test_subscribers')::boolean as reset_test_subscribers;

commit;
