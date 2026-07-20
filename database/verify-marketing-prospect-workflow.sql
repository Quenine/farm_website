-- Read-only Commercial Operations Batch 4.1B verification. No test data is created.
with required_columns(name,data_type,nullable) as (values
 ('id','uuid','NO'),('prospect_id','uuid','NO'),('activity_type','text','NO'),('stage_from','text','YES'),('stage_to','text','YES'),('summary','text','NO'),('occurred_at','timestamp with time zone','NO'),('next_follow_up_at','timestamp with time zone','YES'),('created_by','uuid','YES'),('created_at','timestamp with time zone','NO')
),missing_columns as (
 select r.name from required_columns r left join information_schema.columns c on c.table_schema='public' and c.table_name='marketing_prospect_activities' and c.column_name=r.name and c.data_type=r.data_type and c.is_nullable=r.nullable where c.column_name is null
),checks as (
 select 'activity_table' check_name,(to_regclass('public.marketing_prospect_activities') is not null)::text detail
 union all select 'required_columns',coalesce((select string_agg(name,', ' order by name) from missing_columns),'all present')
 union all select 'prospect_foreign_key',exists(select 1 from pg_constraint where conrelid=to_regclass('public.marketing_prospect_activities') and contype='f' and confrelid=to_regclass('public.marketing_prospects'))::text
 union all select 'rls_enabled',coalesce((select relrowsecurity::text from pg_class where oid=to_regclass('public.marketing_prospect_activities')),'false')
 union all select 'chronological_index',exists(select 1 from pg_indexes where schemaname='public' and indexname='marketing_prospect_activities_prospect_occurred_idx')::text
 union all select 'activity_constraint',exists(select 1 from pg_constraint where conrelid=to_regclass('public.marketing_prospect_activities') and conname='marketing_prospect_activities_activity_type_check')::text
 union all select 'stage_from_constraint',exists(select 1 from pg_constraint where conrelid=to_regclass('public.marketing_prospect_activities') and conname='marketing_prospect_activities_stage_from_check')::text
 union all select 'stage_to_constraint',exists(select 1 from pg_constraint where conrelid=to_regclass('public.marketing_prospect_activities') and conname='marketing_prospect_activities_stage_to_check')::text
 union all select 'stage_rpc',exists(select 1 from pg_proc where oid=to_regprocedure('public.change_marketing_prospect_stage(uuid,text,text,uuid)'))::text
 union all select 'activity_rpc',exists(select 1 from pg_proc where oid=to_regprocedure('public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid)'))::text
 union all select 'follow_up_rpc',exists(select 1 from pg_proc where oid=to_regprocedure('public.complete_marketing_prospect_follow_up(uuid,text,uuid)'))::text
 union all select 'service_role_stage_execute',(case when to_regprocedure('public.change_marketing_prospect_stage(uuid,text,text,uuid)') is null then false else has_function_privilege('service_role',to_regprocedure('public.change_marketing_prospect_stage(uuid,text,text,uuid)'),'execute') end)::text
 union all select 'anon_stage_execute',(case when to_regprocedure('public.change_marketing_prospect_stage(uuid,text,text,uuid)') is null then false else has_function_privilege('anon',to_regprocedure('public.change_marketing_prospect_stage(uuid,text,text,uuid)'),'execute') end)::text
 union all select 'authenticated_stage_execute',(case when to_regprocedure('public.change_marketing_prospect_stage(uuid,text,text,uuid)') is null then false else has_function_privilege('authenticated',to_regprocedure('public.change_marketing_prospect_stage(uuid,text,text,uuid)'),'execute') end)::text
)
select check_name,detail from checks order by check_name;

select id,business_name,stage,updated_at from public.marketing_prospects order by updated_at desc limit 10;
select prospect_id,activity_type,stage_from,stage_to,occurred_at from public.marketing_prospect_activities order by occurred_at desc limit 20;
