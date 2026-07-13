-- Shields Farms content and affiliate publisher verification report.
-- Safe read-only SQL. Run after database/step-content-affiliate-publisher.sql.

with required_tables(table_name) as (
  values
    ('content_authors'), ('content_categories'), ('content_tags'), ('content_posts'),
    ('content_post_tags'), ('content_sources'), ('content_post_sources'), ('content_videos'),
    ('content_post_products'), ('affiliate_partners'), ('affiliate_offers'),
    ('content_post_affiliate_offers'), ('affiliate_clicks'), ('content_product_clicks'),
    ('content_subscribers')
), missing_tables as (
  select table_name from required_tables rt
  where not exists (select 1 from information_schema.tables t where t.table_schema = 'public' and t.table_name = rt.table_name)
), missing_columns as (
  select required.table_name, required.column_name
  from (values
    ('content_posts','search_vector'), ('content_posts','status'), ('content_posts','content_markdown'),
    ('affiliate_offers','destination_url'), ('affiliate_offers','recommendation_basis'),
    ('affiliate_clicks','consent_recorded'), ('content_product_clicks','consent_recorded'),
    ('content_subscribers','unsubscribe_token'), ('orders','content_attribution')
  ) as required(table_name, column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = required.table_name and c.column_name = required.column_name
  )
), post_counts as (
  select
    count(*) filter (where status = 'draft') as drafts,
    count(*) filter (where status = 'review') as reviews,
    count(*) filter (where status = 'published') as published
  from public.content_posts
), orphaned_relationships as (
  select 'content_post_tags' as relation, count(*) as count from public.content_post_tags rel left join public.content_posts p on p.id = rel.post_id left join public.content_tags t on t.id = rel.tag_id where p.id is null or t.id is null
  union all select 'content_post_sources', count(*) from public.content_post_sources rel left join public.content_posts p on p.id = rel.post_id left join public.content_sources s on s.id = rel.source_id where p.id is null or s.id is null
  union all select 'content_post_products', count(*) from public.content_post_products rel left join public.content_posts p on p.id = rel.post_id left join public.products pr on pr.id = rel.product_id where p.id is null or pr.id is null
  union all select 'content_post_affiliate_offers', count(*) from public.content_post_affiliate_offers rel left join public.content_posts p on p.id = rel.post_id left join public.affiliate_offers o on o.id = rel.offer_id where p.id is null or o.id is null
), invalid_source_urls as (
  select title, url from public.content_sources where url !~* '^https?://'
), invalid_offer_urls as (
  select title, destination_url from public.affiliate_offers where destination_url !~* '^https?://'
), published_missing_required as (
  select title, slug from public.content_posts
  where status = 'published'
    and (published_at is null or category_id is null or author_id is null or nullif(trim(title), '') is null or nullif(trim(excerpt), '') is null or length(trim(content_markdown)) < 120 or (featured_image_url is not null and nullif(trim(featured_image_alt), '') is null))
), affiliate_posts_missing_disclosure as (
  select p.title, p.slug
  from public.content_posts p
  where exists (select 1 from public.content_post_affiliate_offers rel where rel.post_id = p.id)
    and p.contains_affiliate_content is not true
), duplicate_active_subscribers as (
  select email, count(*) from public.content_subscribers where status = 'active' group by email having count(*) > 1
)
select 'missing_required_tables' as report, coalesce(string_agg(table_name, ', ' order by table_name), 'none') as detail from missing_tables
union all select 'missing_required_columns', coalesce(string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name), 'none') from missing_columns
union all select 'content_post_counts', 'draft=' || drafts || ', review=' || reviews || ', published=' || published from post_counts
union all select 'active_affiliate_partners', count(*)::text from public.affiliate_partners where is_active = true
union all select 'active_affiliate_offers', count(*)::text from public.affiliate_offers where is_active = true
union all select 'orphaned_relationships', coalesce(string_agg(relation || '=' || count::text, ', ' order by relation), 'none') from orphaned_relationships where count > 0
union all select 'invalid_affiliate_destination_urls', coalesce(string_agg(title || ' -> ' || destination_url, '; ' order by title), 'none') from invalid_offer_urls
union all select 'published_posts_missing_required_fields', coalesce(string_agg(title || ' (' || slug || ')', '; ' order by title), 'none') from published_missing_required
union all select 'sources_with_invalid_urls', coalesce(string_agg(title || ' -> ' || url, '; ' order by title), 'none') from invalid_source_urls
union all select 'affiliate_posts_missing_disclosure_state', coalesce(string_agg(title || ' (' || slug || ')', '; ' order by title), 'none') from affiliate_posts_missing_disclosure
union all select 'active_subscriber_count', count(*)::text from public.content_subscribers where status = 'active'
union all select 'duplicate_active_subscribers', coalesce(string_agg(email || ' x' || count::text, '; ' order by email), 'none') from duplicate_active_subscribers;
