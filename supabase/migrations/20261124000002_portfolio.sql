-- Phase 2: public portfolio content. Every table is owner-owned, every row is
-- RLS-protected, and public readers only ever see published, undeleted rows.

create table public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  slug text not null,
  short_description text,
  description_md text,
  tech_stack text[] not null default '{}',
  github_url text,
  demo_url text,
  image_path text,
  start_date date,
  completion_date date,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_projects_owner_slug unique (owner_id, slug),
  constraint portfolio_projects_github_url_safe
    check (github_url is null or github_url = '' or github_url ~* '^https?://'),
  constraint portfolio_projects_demo_url_safe
    check (demo_url is null or demo_url = '' or demo_url ~* '^https?://')
);

create index portfolio_projects_public_idx
  on public.portfolio_projects (owner_id, is_published, sort_order)
  where deleted_at is null;

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  company text not null,
  position text not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  responsibilities text[] not null default '{}',
  technologies text[] not null default '{}',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index experiences_public_idx
  on public.experiences (owner_id, is_published, sort_order desc)
  where deleted_at is null;

create table public.education (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  institution text not null,
  degree text not null,
  field_of_study text,
  start_date date,
  end_date date,
  description_md text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index education_public_idx
  on public.education (owner_id, is_published, sort_order desc)
  where deleted_at is null;

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  category text not null,
  proficiency smallint check (proficiency between 1 and 5),
  icon text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index skills_public_idx
  on public.skills (owner_id, is_published, category, sort_order)
  where deleted_at is null;

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  issuer text not null,
  issued_on date,
  expires_on date,
  credential_url text,
  -- FK to public.documents is added in the Phase 7 migration.
  document_id uuid,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certifications_credential_url_safe
    check (credential_url is null or credential_url = '' or credential_url ~* '^https?://')
);

create index certifications_public_idx
  on public.certifications (owner_id, is_published, sort_order)
  where deleted_at is null;

create table public.social_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  platform text not null,
  url text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_links_owner_platform unique (owner_id, platform),
  constraint social_links_url_safe
    check (url ~* '^(https?://|mailto:)')
);

