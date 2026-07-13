-- Shields Farms agribusiness content and affiliate publisher engine.
-- Repeat-safe migration. Run only in the Shields Farms Supabase project when content features are enabled.
-- Noble Farms commerce-only deployments do not need this migration while content flags remain disabled.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.normalize_content_subscriber_email()
returns trigger as $$
begin
  new.email = lower(trim(new.email));
  return new;
end;
$$ language plpgsql;

create table if not exists public.content_authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  role_title text,
  bio text,
  avatar_url text,
  avatar_alt text,
  social_links jsonb not null default '{}'::jsonb,
  credentials_or_experience text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  seo_title text,
  seo_description text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null,
  answer_summary text,
  key_takeaways text[],
  content_markdown text not null,
  featured_image_url text,
  featured_image_alt text,
  category_id uuid references public.content_categories(id) on delete set null,
  author_id uuid references public.content_authors(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  content_format text not null default 'article' check (content_format in ('article','video_companion','comparison','resource_guide','case_study','farm_field_note')),
  post_type text not null default 'guide' check (post_type in ('guide','tutorial','buying_guide','review','comparison','case_study','market_insight','farm_update')),
  audience_scope text not null default 'nigeria' check (audience_scope in ('nigeria','africa','global')),
  is_featured boolean not null default false,
  contains_affiliate_content boolean not null default false,
  custom_affiliate_disclosure text,
  recommendation_methodology text,
  seo_title text,
  seo_description text,
  external_canonical_url text,
  published_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(answer_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content_markdown, '')), 'C')
  ) stored,
  constraint content_posts_featured_alt_check check (featured_image_url is null or nullif(trim(featured_image_alt), '') is not null),
  constraint content_posts_published_required_check check (status <> 'published' or (published_at is not null and category_id is not null and author_id is not null and length(trim(content_markdown)) >= 120))
);

create table if not exists public.content_post_tags (
  post_id uuid not null references public.content_posts(id) on delete cascade,
  tag_id uuid not null references public.content_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text,
  url text not null,
  source_type text not null default 'other' check (source_type in ('government','academic','manufacturer','industry_body','merchant','original_interview','original_field_observation','news','other')),
  publication_date date,
  accessed_at timestamptz,
  is_primary_source boolean not null default false,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_sources_url_check check (url ~* '^https?://')
);

create table if not exists public.content_post_sources (
  post_id uuid not null references public.content_posts(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete cascade,
  citation_label text,
  supporting_note text,
  sort_order integer not null default 100,
  primary key (post_id, source_id)
);

create table if not exists public.content_videos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.content_posts(id) on delete cascade,
  platform text not null check (platform in ('youtube','direct_external')),
  external_video_id text,
  embed_url text,
  watch_url text,
  title text not null,
  description text,
  thumbnail_url text,
  thumbnail_alt text,
  duration_seconds integer,
  upload_date date,
  transcript_markdown text,
  chapters jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_videos_url_check check ((embed_url is null or embed_url ~* '^https?://') and (watch_url is null or watch_url ~* '^https?://')),
  constraint content_videos_thumbnail_alt_check check (thumbnail_url is null or nullif(trim(thumbnail_alt), '') is not null)
);

create table if not exists public.content_post_products (
  post_id uuid not null references public.content_posts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 100,
  custom_context text,
  created_at timestamptz not null default now(),
  primary key (post_id, product_id)
);

create table if not exists public.affiliate_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website_url text not null check (website_url ~* '^https?://'),
  affiliate_network text,
  default_disclosure text,
  internal_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_offers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners(id) on delete cascade,
  title text not null,
  slug text not null unique,
  short_description text not null,
  destination_url text not null check (destination_url ~* '^https?://'),
  image_url text,
  image_alt text,
  button_label text not null default 'Check current price',
  display_price text,
  currency text,
  price_last_checked_at timestamptz,
  available_regions text[],
  recommendation_basis text not null check (recommendation_basis in ('personally_tested','editorial_research','merchant_information')),
  is_featured boolean not null default false,
  is_active boolean not null default true,
  internal_commission_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_offers_image_alt_check check (image_url is null or nullif(trim(image_alt), '') is not null)
);

create table if not exists public.content_post_affiliate_offers (
  post_id uuid not null references public.content_posts(id) on delete cascade,
  offer_id uuid not null references public.affiliate_offers(id) on delete cascade,
  sort_order integer not null default 100,
  best_for text,
  editorial_verdict text,
  pros text[],
  cons text[],
  primary key (post_id, offer_id)
);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.affiliate_offers(id) on delete cascade,
  post_id uuid references public.content_posts(id) on delete set null,
  clicked_at timestamptz not null default now(),
  referrer_path text,
  consent_recorded boolean not null default false,
  campaign_context jsonb
);

create table if not exists public.content_product_clicks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.content_posts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  destination_path text not null,
  consent_recorded boolean not null default false
);

create table if not exists public.content_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active' check (status in ('active','unsubscribed','suppressed')),
  source_path text,
  subscription_topic text,
  consent_text text not null,
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unsubscribe_token text not null unique,
  attribution jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists content_attribution jsonb;

create index if not exists content_posts_status_published_idx on public.content_posts(status, published_at desc);
create index if not exists content_posts_category_idx on public.content_posts(category_id);
create index if not exists content_posts_author_idx on public.content_posts(author_id);
create index if not exists content_posts_search_idx on public.content_posts using gin(search_vector);
create index if not exists content_categories_active_idx on public.content_categories(is_active, sort_order);
create index if not exists content_tags_active_idx on public.content_tags(is_active, name);
create index if not exists content_sources_type_idx on public.content_sources(source_type);
create index if not exists content_videos_post_idx on public.content_videos(post_id);
create index if not exists content_post_products_product_idx on public.content_post_products(product_id);
create index if not exists affiliate_partners_active_idx on public.affiliate_partners(is_active);
create index if not exists affiliate_offers_partner_active_idx on public.affiliate_offers(partner_id, is_active);
create index if not exists affiliate_clicks_offer_clicked_idx on public.affiliate_clicks(offer_id, clicked_at desc);
create index if not exists affiliate_clicks_post_clicked_idx on public.affiliate_clicks(post_id, clicked_at desc);
create index if not exists content_product_clicks_post_clicked_idx on public.content_product_clicks(post_id, clicked_at desc);
create index if not exists content_product_clicks_product_clicked_idx on public.content_product_clicks(product_id, clicked_at desc);
create index if not exists content_subscribers_status_idx on public.content_subscribers(status);
create index if not exists content_subscribers_email_idx on public.content_subscribers(email);
create index if not exists orders_content_attribution_idx on public.orders using gin(content_attribution);

create or replace trigger set_content_authors_updated_at before update on public.content_authors for each row execute function public.set_updated_at();
create or replace trigger set_content_categories_updated_at before update on public.content_categories for each row execute function public.set_updated_at();
create or replace trigger set_content_tags_updated_at before update on public.content_tags for each row execute function public.set_updated_at();
create or replace trigger set_content_posts_updated_at before update on public.content_posts for each row execute function public.set_updated_at();
create or replace trigger set_content_sources_updated_at before update on public.content_sources for each row execute function public.set_updated_at();
create or replace trigger set_content_videos_updated_at before update on public.content_videos for each row execute function public.set_updated_at();
create or replace trigger set_affiliate_partners_updated_at before update on public.affiliate_partners for each row execute function public.set_updated_at();
create or replace trigger set_affiliate_offers_updated_at before update on public.affiliate_offers for each row execute function public.set_updated_at();
create or replace trigger set_content_subscribers_updated_at before update on public.content_subscribers for each row execute function public.set_updated_at();
create or replace trigger normalize_content_subscriber_email_before_write before insert or update on public.content_subscribers for each row execute function public.normalize_content_subscriber_email();

alter table public.content_authors enable row level security;
alter table public.content_categories enable row level security;
alter table public.content_tags enable row level security;
alter table public.content_posts enable row level security;
alter table public.content_post_tags enable row level security;
alter table public.content_sources enable row level security;
alter table public.content_post_sources enable row level security;
alter table public.content_videos enable row level security;
alter table public.content_post_products enable row level security;
alter table public.affiliate_partners enable row level security;
alter table public.affiliate_offers enable row level security;
alter table public.content_post_affiliate_offers enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.content_product_clicks enable row level security;
alter table public.content_subscribers enable row level security;
