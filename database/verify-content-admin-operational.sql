-- Shields Farms content admin operational verification.
-- Safe read-only SQL. Run after database/step-content-affiliate-publisher.sql.
-- Reports required tables, columns, foreign keys, indexes, RLS/policies, counts and orphaned relationships.

with required_tables(table_name) as (
  values
    ('content_authors'), ('content_categories'), ('content_tags'), ('content_posts'),
    ('content_post_tags'), ('content_sources'), ('content_post_sources'), ('content_videos'),
    ('content_post_products'), ('affiliate_partners'), ('affiliate_offers'),
    ('content_post_affiliate_offers'), ('affiliate_clicks'), ('content_product_clicks'),
    ('content_subscribers'), ('orders'), ('products')
), required_columns(table_name, column_name) as (
  values
    ('content_posts','deleted_at'), ('content_posts','deleted_by'),
    ('content_authors','deleted_at'), ('content_authors','deleted_by'),
    ('content_categories','deleted_at'), ('content_categories','deleted_by'),
    ('content_tags','deleted_at'), ('content_tags','deleted_by'),
    ('content_sources','deleted_at'), ('content_sources','deleted_by'),
    ('content_videos','deleted_at'), ('content_videos','deleted_by'),
    ('affiliate_partners','deleted_at'), ('affiliate_partners','deleted_by'),
    ('affiliate_offers','deleted_at'), ('affiliate_offers','deleted_by'),
    ('content_authors','id'), ('content_authors','name'), ('content_authors','slug'), ('content_authors','role_title'), ('content_authors','bio'), ('content_authors','avatar_url'), ('content_authors','avatar_alt'), ('content_authors','social_links'), ('content_authors','credentials_or_experience'), ('content_authors','is_active'), ('content_authors','updated_at'),
    ('content_categories','id'), ('content_categories','name'), ('content_categories','slug'), ('content_categories','description'), ('content_categories','seo_title'), ('content_categories','seo_description'), ('content_categories','sort_order'), ('content_categories','is_active'),
    ('content_tags','id'), ('content_tags','name'), ('content_tags','slug'), ('content_tags','description'), ('content_tags','is_active'),
    ('content_sources','id'), ('content_sources','title'), ('content_sources','publisher'), ('content_sources','url'), ('content_sources','source_type'), ('content_sources','publication_date'), ('content_sources','accessed_at'), ('content_sources','is_primary_source'), ('content_sources','internal_note'), ('content_sources','is_active'),
    ('content_posts','id'), ('content_posts','title'), ('content_posts','slug'), ('content_posts','excerpt'), ('content_posts','content_markdown'), ('content_posts','category_id'), ('content_posts','author_id'), ('content_posts','status'), ('content_posts','content_format'), ('content_posts','post_type'), ('content_posts','audience_scope'), ('content_posts','search_vector'),
    ('content_videos','id'), ('content_videos','post_id'), ('content_videos','platform'), ('content_videos','external_video_id'), ('content_videos','embed_url'), ('content_videos','watch_url'), ('content_videos','title'), ('content_videos','thumbnail_url'), ('content_videos','thumbnail_alt'), ('content_videos','duration_seconds'), ('content_videos','upload_date'), ('content_videos','transcript_markdown'), ('content_videos','chapters'), ('content_videos','is_active'),
    ('affiliate_partners','id'), ('affiliate_partners','name'), ('affiliate_partners','slug'), ('affiliate_partners','website_url'), ('affiliate_partners','affiliate_network'), ('affiliate_partners','default_disclosure'), ('affiliate_partners','internal_notes'), ('affiliate_partners','is_active'),
    ('affiliate_offers','id'), ('affiliate_offers','partner_id'), ('affiliate_offers','title'), ('affiliate_offers','slug'), ('affiliate_offers','destination_url'), ('affiliate_offers','recommendation_basis'), ('affiliate_offers','available_regions'), ('affiliate_offers','price_last_checked_at'), ('affiliate_offers','internal_commission_note'), ('affiliate_offers','is_active'),
    ('content_subscribers','id'), ('content_subscribers','email'), ('content_subscribers','status'), ('content_subscribers','source_path'), ('content_subscribers','subscription_topic'), ('content_subscribers','unsubscribe_token'),
    ('orders','content_attribution')
), required_indexes(index_name) as (
  values
    ('content_posts_deleted_at_idx'), ('content_authors_deleted_at_idx'), ('content_categories_deleted_at_idx'),
    ('content_tags_deleted_at_idx'), ('content_sources_deleted_at_idx'), ('content_videos_deleted_at_idx'),
    ('affiliate_partners_deleted_at_idx'), ('affiliate_offers_deleted_at_idx'),
    ('content_posts_status_published_idx'), ('content_posts_category_idx'), ('content_posts_author_idx'), ('content_posts_search_idx'),
    ('content_categories_active_idx'), ('content_tags_active_idx'), ('content_sources_type_idx'), ('content_sources_active_idx'),
    ('content_videos_post_idx'), ('content_videos_active_idx'), ('content_post_products_product_idx'),
    ('affiliate_partners_active_idx'), ('affiliate_offers_partner_active_idx'), ('affiliate_clicks_offer_clicked_idx'),
    ('affiliate_clicks_post_clicked_idx'), ('content_product_clicks_post_clicked_idx'), ('content_product_clicks_product_clicked_idx'),
    ('content_subscribers_status_idx'), ('content_subscribers_email_idx'), ('orders_content_attribution_idx')
), required_fks(table_name, column_name, foreign_table_name) as (
  values
    ('content_posts','category_id','content_categories'), ('content_posts','author_id','content_authors'),
    ('content_post_tags','post_id','content_posts'), ('content_post_tags','tag_id','content_tags'),
    ('content_post_sources','post_id','content_posts'), ('content_post_sources','source_id','content_sources'),
    ('content_videos','post_id','content_posts'),
    ('content_post_products','post_id','content_posts'), ('content_post_products','product_id','products'),
    ('affiliate_offers','partner_id','affiliate_partners'),
    ('content_post_affiliate_offers','post_id','content_posts'), ('content_post_affiliate_offers','offer_id','affiliate_offers'),
    ('affiliate_clicks','offer_id','affiliate_offers'), ('affiliate_clicks','post_id','content_posts'),
    ('content_product_clicks','post_id','content_posts'), ('content_product_clicks','product_id','products')
), missing_tables as (
  select table_name from required_tables rt
  where not exists (select 1 from information_schema.tables t where t.table_schema = 'public' and t.table_name = rt.table_name)
), missing_columns as (
  select rc.table_name, rc.column_name from required_columns rc
  where not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = rc.table_name and c.column_name = rc.column_name)
), missing_indexes as (
  select index_name from required_indexes ri
  where not exists (select 1 from pg_indexes i where i.schemaname = 'public' and i.indexname = ri.index_name)
), missing_fks as (
  select rf.table_name, rf.column_name, rf.foreign_table_name
  from required_fks rf
  where not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and tc.table_name = rf.table_name
      and kcu.column_name = rf.column_name
      and ccu.table_name = rf.foreign_table_name
  )
), rls_status as (
  select c.relname as table_name, c.relrowsecurity as rls_enabled, count(pol.oid) as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy pol on pol.polrelid = c.oid
  where n.nspname = 'public'
    and c.relname in (select table_name from required_tables where table_name like 'content_%' or table_name like 'affiliate_%')
  group by c.relname, c.relrowsecurity
), orphaned_relationships as (
  select 'content_post_tags' as relation, count(*) as count from public.content_post_tags rel left join public.content_posts p on p.id = rel.post_id left join public.content_tags t on t.id = rel.tag_id where p.id is null or t.id is null
  union all select 'content_post_sources', count(*) from public.content_post_sources rel left join public.content_posts p on p.id = rel.post_id left join public.content_sources s on s.id = rel.source_id where p.id is null or s.id is null
  union all select 'content_post_products', count(*) from public.content_post_products rel left join public.content_posts p on p.id = rel.post_id left join public.products pr on pr.id = rel.product_id where p.id is null or pr.id is null
  union all select 'content_post_affiliate_offers', count(*) from public.content_post_affiliate_offers rel left join public.content_posts p on p.id = rel.post_id left join public.affiliate_offers o on o.id = rel.offer_id where p.id is null or o.id is null
), counts as (
  select 'content_authors' as table_name, count(*) as count from public.content_authors
  union all select 'content_categories', count(*) from public.content_categories
  union all select 'content_tags', count(*) from public.content_tags
  union all select 'content_sources', count(*) from public.content_sources
  union all select 'content_posts', count(*) from public.content_posts
  union all select 'content_videos', count(*) from public.content_videos
  union all select 'affiliate_partners', count(*) from public.affiliate_partners
  union all select 'affiliate_offers', count(*) from public.affiliate_offers
  union all select 'content_subscribers', count(*) from public.content_subscribers
)
select 'missing_tables' as report, coalesce(string_agg(table_name, ', ' order by table_name), 'none') as detail from missing_tables
union all select 'missing_columns', coalesce(string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name), 'none') from missing_columns
union all select 'missing_foreign_keys', coalesce(string_agg(table_name || '.' || column_name || ' -> ' || foreign_table_name, ', ' order by table_name, column_name), 'none') from missing_fks
union all select 'missing_indexes', coalesce(string_agg(index_name, ', ' order by index_name), 'none') from missing_indexes
union all select 'rls_status', coalesce(string_agg(table_name || ': rls=' || rls_enabled::text || ', policies=' || policy_count::text, '; ' order by table_name), 'none') from rls_status
union all select 'record_counts', coalesce(string_agg(table_name || '=' || count::text, ', ' order by table_name), 'none') from counts
union all select 'orphaned_relationships', coalesce(string_agg(relation || '=' || count::text, ', ' order by relation), 'none') from orphaned_relationships where count > 0;
