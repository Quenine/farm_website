-- Read-only definitive Marketing Operations verification.
-- Does not insert, update, or delete data.

-- =========================================================
-- 1. VERIFICATION SUMMARY
-- =========================================================

with function_inventory as (
  select
    p.oid,
    n.nspname,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as result_type,
    r.rolname as owner,
    p.prosecdef as security_definer,
    coalesce(array_to_string(p.proconfig, ','), '') as configuration
  from pg_proc as p
  join pg_namespace as n
    on n.oid = p.pronamespace
  join pg_roles as r
    on r.oid = p.proowner
  where n.nspname = 'public'
    and p.proname in (
      'change_marketing_prospect_stage',
      'transition_marketing_prospect',
      'record_marketing_prospect_activity',
      'complete_marketing_prospect_follow_up',
      'test_marketing_operations'
    )
),
required_columns(table_name, column_name) as (
  values
    ('marketing_prospect_activities', 'prospect_id'),
    ('marketing_prospect_activities', 'activity_type'),
    ('marketing_prospect_activities', 'stage_from'),
    ('marketing_prospect_activities', 'stage_to'),
    ('marketing_prospect_activities', 'summary'),
    ('marketing_prospect_activities', 'occurred_at'),
    ('marketing_prospect_activities', 'next_follow_up_at'),
    ('marketing_prospect_activities', 'created_by'),

    ('marketing_social_activities', 'status'),
    ('marketing_social_activities', 'scheduled_at'),
    ('marketing_social_activities', 'published_at'),
    ('marketing_social_activities', 'reach'),
    ('marketing_social_activities', 'impressions'),
    ('marketing_social_activities', 'likes'),
    ('marketing_social_activities', 'comments'),
    ('marketing_social_activities', 'shares'),
    ('marketing_social_activities', 'saves'),
    ('marketing_social_activities', 'direct_message_leads'),
    ('marketing_social_activities', 'attributed_orders')
),
missing_columns as (
  select
    required.table_name,
    required.column_name
  from required_columns as required
  where not exists (
    select 1
    from information_schema.columns as columns
    where columns.table_schema = 'public'
      and columns.table_name = required.table_name
      and columns.column_name = required.column_name
  )
)
select
  'definitive_stage_signature' as report,
  (
    count(*) filter (
      where proname = 'transition_marketing_prospect'
        and arguments =
          'p_prospect_id uuid, p_target_stage text, p_summary text, p_actor_id uuid'
    ) = 1
  )::text as detail
from function_inventory

union all

select
  'obsolete_stage_signatures_removed',
  (
    count(*) filter (
      where proname = 'change_marketing_prospect_stage'
    ) = 0
  )::text
from function_inventory

union all

select
  'no_stage_overloads',
  (
    count(*) filter (
      where proname = 'transition_marketing_prospect'
    ) = 1
  )::text
from function_inventory

union all

select
  'activity_signature',
  (
    count(*) filter (
      where proname = 'record_marketing_prospect_activity'
    ) = 1
  )::text
from function_inventory

union all

select
  'follow_up_signature',
  (
    count(*) filter (
      where proname = 'complete_marketing_prospect_follow_up'
    ) = 1
  )::text
from function_inventory

union all

select
  'self_test_signature',
  (
    count(*) filter (
      where proname = 'test_marketing_operations'
    ) = 1
  )::text
from function_inventory

union all

select
  'all_security_definer',
  coalesce(bool_and(security_definer), false)::text
from function_inventory
where proname <> 'change_marketing_prospect_stage'

union all

select
  'safe_search_path',
  coalesce(
    bool_and(
      configuration like '%search_path=public, pg_temp%'
      or configuration like '%search_path=public,pg_temp%'
    ),
    false
  )::text
from function_inventory
where proname <> 'change_marketing_prospect_stage'

union all

select
  'service_role_execute',
  coalesce(
    bool_and(has_function_privilege('service_role', oid, 'execute')),
    false
  )::text
from function_inventory
where proname <> 'change_marketing_prospect_stage'

union all

select
  'anon_execute_revoked',
  coalesce(
    bool_and(not has_function_privilege('anon', oid, 'execute')),
    false
  )::text
from function_inventory
where proname <> 'change_marketing_prospect_stage'

union all

select
  'authenticated_execute_revoked',
  coalesce(
    bool_and(not has_function_privilege('authenticated', oid, 'execute')),
    false
  )::text
from function_inventory
where proname <> 'change_marketing_prospect_stage'

union all

select
  'missing_columns',
  coalesce(
    (
      select string_agg(
        table_name || '.' || column_name,
        ', '
        order by table_name, column_name
      )
      from missing_columns
    ),
    'none'
  )

union all

select
  'activity_rls',
  coalesce(
    (
      select relrowsecurity::text
      from pg_class
      where oid = to_regclass('public.marketing_prospect_activities')
    ),
    'false'
  )

union all

select
  'social_rls',
  coalesce(
    (
      select relrowsecurity::text
      from pg_class
      where oid = to_regclass('public.marketing_social_activities')
    ),
    'false'
  )

union all

select
  'activity_index',
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname =
        'marketing_prospect_activities_prospect_occurred_idx'
  )::text

union all

select
  'social_index',
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'marketing_social_scheduled_idx'
  )::text;


-- =========================================================
-- 2. EXACT FUNCTION INVENTORY
-- The CTE must be declared again because CTE scope ends
-- after the previous statement.
-- =========================================================

with function_inventory as (
  select
    p.oid,
    n.nspname,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as result_type,
    r.rolname as owner,
    p.prosecdef as security_definer,
    coalesce(array_to_string(p.proconfig, ','), '') as configuration,
    has_function_privilege('service_role', p.oid, 'execute')
      as service_role_execute,
    has_function_privilege('anon', p.oid, 'execute')
      as anon_execute,
    has_function_privilege('authenticated', p.oid, 'execute')
      as authenticated_execute
  from pg_proc as p
  join pg_namespace as n
    on n.oid = p.pronamespace
  join pg_roles as r
    on r.oid = p.proowner
  where n.nspname = 'public'
    and p.proname in (
      'change_marketing_prospect_stage',
      'transition_marketing_prospect',
      'record_marketing_prospect_activity',
      'complete_marketing_prospect_follow_up',
      'test_marketing_operations'
    )
)
select
  proname,
  arguments,
  result_type,
  owner,
  security_definer,
  configuration,
  service_role_execute,
  anon_execute,
  authenticated_execute
from function_inventory
order by proname, arguments;


-- =========================================================
-- 3. READ-ONLY RECORD SUMMARY
-- =========================================================

select
  'prospects' as entity,
  count(*) as records,
  max(updated_at) as latest_update
from public.marketing_prospects

union all

select
  'prospect activities',
  count(*),
  max(occurred_at)
from public.marketing_prospect_activities

union all

select
  'social activities',
  count(*),
  max(updated_at)
from public.marketing_social_activities;