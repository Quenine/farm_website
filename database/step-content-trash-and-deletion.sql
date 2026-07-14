-- Shields Farms content trash and safe-deletion foundation.
-- Run after database/step-content-affiliate-publisher.sql.
-- This migration is non-destructive. It adds soft-delete metadata only.
-- Do not run hard deletes automatically. Use admin confirmation flows after backup/review.

begin;

alter table if exists public.content_posts
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

alter table if exists public.content_authors
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

alter table if exists public.content_categories
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

alter table if exists public.content_tags
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

alter table if exists public.content_sources
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

alter table if exists public.content_videos
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

alter table if exists public.affiliate_partners
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

alter table if exists public.affiliate_offers
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

create index if not exists content_posts_deleted_at_idx on public.content_posts(deleted_at);
create index if not exists content_authors_deleted_at_idx on public.content_authors(deleted_at);
create index if not exists content_categories_deleted_at_idx on public.content_categories(deleted_at);
create index if not exists content_tags_deleted_at_idx on public.content_tags(deleted_at);
create index if not exists content_sources_deleted_at_idx on public.content_sources(deleted_at);
create index if not exists content_videos_deleted_at_idx on public.content_videos(deleted_at);
create index if not exists affiliate_partners_deleted_at_idx on public.affiliate_partners(deleted_at);
create index if not exists affiliate_offers_deleted_at_idx on public.affiliate_offers(deleted_at);

comment on column public.content_posts.deleted_at is 'Soft-delete timestamp. Published posts must be unpublished before trashing.';
comment on column public.affiliate_offers.deleted_at is 'Soft-delete timestamp. Redirects for trashed offers must remain disabled by is_active=false.';
comment on column public.affiliate_partners.deleted_at is 'Soft-delete timestamp. Trashing a partner deactivates it and disables related redirects through partner inactivity.';

commit;
