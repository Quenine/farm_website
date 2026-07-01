-- DESTRUCTIVE LAUNCH CLEANUP SCRIPT
-- Run this only after backing up production data and only before accepting real orders.
--
-- Purpose:
--   Clear test transactional records before launch while preserving catalogue,
--   delivery configuration, admin/auth users, settings, and site content.
--
-- Preserved tables include, but are not limited to:
--   public.products
--   public.categories
--   public.product_images
--   public.product_media
--   public.product_delivery_rates
--   public.delivery_rates
--   public.delivery_zones
--   public.app_settings
--   public.profiles / auth users
--
-- Stock warning:
--   Test paid orders may have reduced product stock through inventory deduction.
--   After clearing test orders, admin must confirm product stock quantities
--   manually before accepting real orders. This script does not reset stock.

begin;

-- Show row counts before cleanup. Missing optional tables are skipped.
do $$
declare
  table_name text;
  table_names text[] := array[
    'order_status_notifications',
    'order_notifications',
    'notification_logs',
    'payment_events',
    'payments',
    'inventory_movements',
    'order_items',
    'orders'
  ];
  row_count bigint;
begin
  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('select count(*) from public.%I', table_name) into row_count;
      raise notice 'before cleanup: public.% rows = %', table_name, row_count;
    else
      raise notice 'before cleanup: public.% does not exist, skipping count', table_name;
    end if;
  end loop;
end $$;

-- Delete notification/idempotency logs first.
do $$
begin
  if to_regclass('public.order_status_notifications') is not null then
    execute 'delete from public.order_status_notifications';
  end if;

  if to_regclass('public.order_notifications') is not null then
    execute 'delete from public.order_notifications';
  end if;

  if to_regclass('public.notification_logs') is not null then
    execute 'delete from public.notification_logs';
  end if;
end $$;

-- Delete optional payment event logs before core payment rows.
do $$
begin
  if to_regclass('public.payment_events') is not null then
    execute 'delete from public.payment_events';
  end if;
end $$;

-- Delete transactional records in foreign-key-safe order.
do $$
begin
  if to_regclass('public.payments') is not null then
    execute 'delete from public.payments';
  end if;

  if to_regclass('public.inventory_movements') is not null then
    execute 'delete from public.inventory_movements';
  end if;

  if to_regclass('public.order_items') is not null then
    execute 'delete from public.order_items';
  end if;

  if to_regclass('public.orders') is not null then
    execute 'delete from public.orders';
  end if;
end $$;

-- Show row counts after cleanup. Missing optional tables are skipped.
do $$
declare
  table_name text;
  table_names text[] := array[
    'order_status_notifications',
    'order_notifications',
    'notification_logs',
    'payment_events',
    'payments',
    'inventory_movements',
    'order_items',
    'orders'
  ];
  row_count bigint;
begin
  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('select count(*) from public.%I', table_name) into row_count;
      raise notice 'after cleanup: public.% rows = %', table_name, row_count;
    end if;
  end loop;
end $$;

commit;
