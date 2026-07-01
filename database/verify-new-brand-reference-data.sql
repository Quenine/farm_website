-- Shields Farms / new brand verification report
-- Safe SQL for reporting counts. This script does not modify application data.
-- It creates only a temporary report table in the current SQL session.
--
-- Purpose:
--   After setting up a separate Supabase project for a new farm brand,
--   confirm reference data exists and transactional tables are empty.
--
-- Expected before public launch:
--   Reference tables should have records.
--   Transactional tables should be zero.

drop table if exists pg_temp.new_brand_reference_data_report;

create temporary table new_brand_reference_data_report (
  table_group text not null,
  table_name text not null,
  table_status text not null default 'unchecked',
  row_count bigint,
  expected_before_launch text not null
) on commit drop;

insert into new_brand_reference_data_report (table_group, table_name, expected_before_launch)
values
  ('reference', 'categories', 'should have records'),
  ('reference', 'products', 'should have records'),
  ('reference', 'product_images', 'should have records if legacy images are used'),
  ('reference', 'product_media', 'should have records if product media is uploaded or copied'),
  ('reference', 'product_delivery_rates', 'should have records'),
  ('reference', 'delivery_rates', 'should have records if fallback delivery rates are used'),
  ('reference', 'delivery_zones', 'should have records if delivery zones are used'),
  ('reference', 'app_settings', 'may have records if settings are configured'),
  ('transactional', 'orders', 'should be zero before public launch'),
  ('transactional', 'order_items', 'should be zero before public launch'),
  ('transactional', 'payments', 'should be zero before public launch'),
  ('transactional', 'inventory_movements', 'should be zero before public launch'),
  ('transactional', 'order_status_notifications', 'should be zero before public launch');

do $$
declare
  report_row record;
  counted_rows bigint;
begin
  for report_row in
    select table_name
    from new_brand_reference_data_report
  loop
    if to_regclass(format('public.%I', report_row.table_name)) is null then
      update new_brand_reference_data_report
      set table_status = 'missing', row_count = null
      where table_name = report_row.table_name;
    else
      execute format('select count(*)::bigint from public.%I', report_row.table_name)
      into counted_rows;

      update new_brand_reference_data_report
      set table_status = 'exists', row_count = counted_rows
      where table_name = report_row.table_name;
    end if;
  end loop;
end $$;

select
  table_group,
  table_name,
  table_status,
  row_count,
  expected_before_launch
from new_brand_reference_data_report
order by
  case table_group when 'reference' then 1 else 2 end,
  table_name;
