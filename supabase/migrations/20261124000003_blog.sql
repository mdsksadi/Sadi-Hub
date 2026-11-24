-- Phase 3: blog CMS. Posts are the only published-content table with an
-- explicit lifecycle, so public readers only ever see live published rows.

create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_categories_owner_slug unique (owner_id, slug)
);

create table public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_tags_owner_slug unique (owner_id, slug)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  slug text not null,
  excerpt text,
  content_md text not null default '',
  cover_path text,
  category_id uuid references public.blog_categories (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'archived')),
  published_at timestamptz,
  scheduled_for timestamptz,
  seo_title text,
  seo_description text,
  is_featured boolean not null default false,
  reading_minutes integer generated always as
    (greatest(1, ceil(length(content_md) / 1200.0))::integer) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_owner_slug unique (owner_id, slug),
  constraint posts_published_has_date
    check (status <> 'published' or published_at is not null),
  constraint posts_scheduled_has_date
    check (status <> 'scheduled' or scheduled_for is not null)
);

create index posts_public_idx
  on public.posts (owner_id, status, published_at desc)
  where deleted_at is null;

create index posts_category_idx on public.posts (owner_id, category_id);

create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tag_id uuid not null references public.blog_tags (id) on delete cascade,
  primary key (post_id, tag_id)
);

create index post_tags_tag_idx on public.post_tags (tag_id, post_id);

