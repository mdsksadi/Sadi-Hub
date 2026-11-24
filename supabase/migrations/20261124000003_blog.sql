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

-- ---------------------------------------------------------------------------
-- Scheduled publishing. The caller still goes through RLS and the owner gate.
-- ---------------------------------------------------------------------------

create or replace function public.publish_scheduled_posts()
returns table (id uuid, slug text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform public.require_owner();

  return query
    update public.posts p
       set status = 'published',
           published_at = now(),
           updated_at = now()
     where p.owner_id = (select auth.uid())
       and p.status = 'scheduled'
       and p.deleted_at is null
       and p.scheduled_for <= now()
    returning p.id, p.slug;
end;
$$;

revoke all on function public.publish_scheduled_posts() from public, anon;
grant execute on function public.publish_scheduled_posts() to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers. post_tags intentionally has no audit trigger: audit_mutation()
-- expects a single `id` column, while post_tags uses a composite key.
-- ---------------------------------------------------------------------------

create trigger blog_categories_set_updated_at
  before update on public.blog_categories
  for each row execute function public.set_updated_at();
create trigger blog_tags_set_updated_at
  before update on public.blog_tags
  for each row execute function public.set_updated_at();
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create trigger blog_categories_audit
  after insert or update or delete on public.blog_categories
  for each row execute function public.audit_mutation();
create trigger blog_tags_audit
  after insert or update or delete on public.blog_tags
  for each row execute function public.audit_mutation();
create trigger posts_audit
  after insert or update or delete on public.posts
  for each row execute function public.audit_mutation();

-- ---------------------------------------------------------------------------
-- RLS: the owner has full control; anon/foreign users only see live posts and
-- the taxonomies actually used by live posts.
-- ---------------------------------------------------------------------------

alter table public.blog_categories enable row level security;
alter table public.blog_tags enable row level security;
alter table public.posts enable row level security;
alter table public.post_tags enable row level security;

create policy blog_categories_owner_all on public.blog_categories
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());
create policy blog_categories_public_read on public.blog_categories
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.category_id = public.blog_categories.id
        and p.status = 'published'
        and p.published_at <= now()
        and p.deleted_at is null
    )
  );

create policy blog_tags_owner_all on public.blog_tags
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());
create policy blog_tags_public_read on public.blog_tags
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.post_tags pt
      join public.posts p on p.id = pt.post_id
      where pt.tag_id = public.blog_tags.id
        and p.status = 'published'
        and p.published_at <= now()
        and p.deleted_at is null
    )
  );

create policy posts_owner_all on public.posts
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());
create policy posts_public_read on public.posts
  for select to anon, authenticated
  using (
    status = 'published'
    and published_at <= now()
    and deleted_at is null
  );

create policy post_tags_owner_all on public.post_tags
  for all to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = public.post_tags.post_id
        and p.owner_id = (select auth.uid())
        and public.is_owner()
    )
  )
  with check (
    exists (
      select 1 from public.posts p
      where p.id = public.post_tags.post_id
        and p.owner_id = (select auth.uid())
        and public.is_owner()
    )
  );
create policy post_tags_public_read on public.post_tags
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = public.post_tags.post_id
        and p.status = 'published'
        and p.published_at <= now()
        and p.deleted_at is null
    )
  );

grant select on public.blog_categories, public.blog_tags, public.posts,
  public.post_tags to anon, authenticated;
grant insert, update, delete on public.blog_categories, public.blog_tags,
  public.posts, public.post_tags to authenticated;
revoke insert, update, delete on public.blog_categories, public.blog_tags,
  public.posts, public.post_tags from anon;
