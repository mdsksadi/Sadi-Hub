-- LOCAL DEVELOPMENT ONLY.
-- Creates the single owner and placeholder public content for `supabase db reset`.
-- Never run this against production. Replace the fixed UUID with your real
-- Auth user id and follow docs/DATABASE.md for production provisioning.

begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'owner@example.com',
  crypt('ChangeMe-123456789', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Sadi"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id,
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  'owner@example.com',
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  '{"sub":"00000000-0000-4000-8000-000000000001","email":"owner@example.com"}'::jsonb,
  'email',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do nothing;

insert into public.profiles (
  id, email, display_name, role, status, headline, bio_md, location, timezone
)
values (
  '00000000-0000-4000-8000-000000000001',
  'owner@example.com',
  'Sadi',
  'owner',
  'active',
  'Software engineer building useful things.',
  'Hello! I am Sadi, a software engineer interested in reliable systems, finance tooling and simple user experiences.',
  'Dhaka, Bangladesh',
  'Asia/Dhaka'
)
on conflict (id) do nothing;

insert into public.user_settings (user_id, reporting_currency)
values ('00000000-0000-4000-8000-000000000001', 'EUR')
on conflict (user_id) do nothing;

-- This file is reset-only, but clearing the placeholder rows makes an accidental
-- second run idempotent instead of duplicating content without unique keys.
delete from public.social_links where owner_id = '00000000-0000-4000-8000-000000000001';
delete from public.certifications where owner_id = '00000000-0000-4000-8000-000000000001';
delete from public.skills where owner_id = '00000000-0000-4000-8000-000000000001';
delete from public.education where owner_id = '00000000-0000-4000-8000-000000000001';
delete from public.experiences where owner_id = '00000000-0000-4000-8000-000000000001';
delete from public.portfolio_projects where owner_id = '00000000-0000-4000-8000-000000000001';

insert into public.exchange_rates (from_currency, to_currency, rate, effective_date, source)
values ('EUR', 'BDT', 120.00000000, date '2026-01-01', 'Placeholder local seed rate')
on conflict (from_currency, to_currency, effective_date) do nothing;

insert into public.portfolio_projects (
  owner_id, title, slug, short_description, description_md, tech_stack,
  github_url, sort_order, is_featured, is_published
)
values (
  '00000000-0000-4000-8000-000000000001',
  'Sadi Hub',
  'sadi-hub',
  'A private, single-owner hub for portfolio, writing and personal finance.',
  'A modular monolith on Next.js and Supabase with an append-only cash ledger.',
  array['Next.js', 'TypeScript', 'Supabase', 'Cloudflare Workers'],
  'https://github.com/mdsksadi/Sadi-Hub',
  10,
  true,
  true
)
on conflict (owner_id, slug) do nothing;

insert into public.experiences (
  owner_id, company, position, start_date, end_date, is_current, responsibilities, technologies, sort_order
)
values (
  '00000000-0000-4000-8000-000000000001',
  'Example Company',
  'Software Engineer',
  date '2023-01-01',
  null,
  true,
  array['Design and ship reliable web services.', 'Mentor teammates on testing and security.'],
  array['TypeScript', 'PostgreSQL', 'React'],
  10
)
on conflict do nothing;

insert into public.education (
  owner_id, institution, degree, field_of_study, start_date, end_date, sort_order
)
values (
  '00000000-0000-4000-8000-000000000001',
  'Example University',
  'BSc',
  'Computer Science',
  date '2018-09-01',
  date '2022-06-30',
  10
)
on conflict do nothing;

insert into public.skills (owner_id, name, category, proficiency, sort_order)
values
  ('00000000-0000-4000-8000-000000000001', 'TypeScript', 'Languages', 5, 10),
  ('00000000-0000-4000-8000-000000000001', 'PostgreSQL', 'Data', 4, 20),
  ('00000000-0000-4000-8000-000000000001', 'React', 'Frameworks', 5, 30)
on conflict do nothing;

insert into public.certifications (owner_id, name, issuer, issued_on, credential_url, sort_order)
values (
  '00000000-0000-4000-8000-000000000001',
  'Example Certification',
  'Example Institute',
  date '2024-05-01',
  'https://example.com/certificate',
  10
)
on conflict do nothing;

insert into public.social_links (owner_id, platform, url, sort_order)
values
  ('00000000-0000-4000-8000-000000000001', 'github', 'https://github.com/mdsksadi', 10),
  ('00000000-0000-4000-8000-000000000001', 'email', 'mailto:owner@example.com', 20)
on conflict (owner_id, platform) do nothing;

-- Blog taxonomy and sample posts. The draft and future-scheduled rows exist so
-- public-visibility tests have a concrete negative case.
insert into public.blog_categories (owner_id, name, slug, description)
values
  ('00000000-0000-4000-8000-000000000001', 'Engineering', 'engineering', 'Notes on building software.'),
  ('00000000-0000-4000-8000-000000000001', 'Personal', 'personal', 'Life and reflections.')
on conflict (owner_id, slug) do nothing;

insert into public.blog_tags (owner_id, name, slug)
values
  ('00000000-0000-4000-8000-000000000001', 'Next.js', 'nextjs'),
  ('00000000-0000-4000-8000-000000000001', 'Supabase', 'supabase'),
  ('00000000-0000-4000-8000-000000000001', 'Security', 'security')
on conflict (owner_id, slug) do nothing;

insert into public.posts (
  owner_id, author_id, title, slug, excerpt, content_md, category_id,
  status, published_at, is_featured
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Building Sadi Hub',
    'building-sadi-hub',
    'How this single-owner hub is put together.',
    E'## Architecture\n\nA modular monolith on Next.js 16 and Supabase.\n\n```ts\nconst status = "published";\nconsole.log(status);\n```\n\nEverything private is protected by RLS.',
    (select id from public.blog_categories where owner_id = '00000000-0000-4000-8000-000000000001' and slug = 'engineering'),
    'published',
    now() - interval '1 day',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Draft: Unpublished Notes',
    'draft-unpublished-notes',
    'This post must never appear publicly.',
    'Draft body.',
    null,
    'draft',
    null,
    false
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Scheduled: Next Week',
    'scheduled-next-week',
    'A future post.',
    'Scheduled body.',
    null,
    'scheduled',
    now() + interval '1 day',
    false
  )
on conflict (owner_id, slug) do nothing;

-- Link tags to the published sample post (idempotent).
insert into public.post_tags (post_id, tag_id)
select p.id, t.id
from public.posts p
cross join public.blog_tags t
where p.owner_id = '00000000-0000-4000-8000-000000000001'
  and p.slug = 'building-sadi-hub'
  and t.owner_id = '00000000-0000-4000-8000-000000000001'
  and t.slug in ('nextjs', 'supabase', 'security')
on conflict do nothing;

-- Local finance/lending/donations fixtures. Financial movements are created
-- through the app RPCs; the seed only provides the reference rows and the
-- inverse snapshot rate needed to translate BDT amounts into the EUR report.
insert into public.exchange_rates (from_currency, to_currency, rate, effective_date, source)
values ('BDT', 'EUR', 0.00833333, date '2026-01-01', 'Inverse placeholder local seed rate')
on conflict (from_currency, to_currency, effective_date) do nothing;

insert into public.accounts (
  owner_id, name, country_code, currency_code, account_type,
  opening_balance, opening_date, is_active
)
values
  ('00000000-0000-4000-8000-000000000001', 'EUR checking', 'DE', 'EUR', 'bank', 1000, date '2026-01-01', true),
  ('00000000-0000-4000-8000-000000000001', 'BDT wallet', 'BD', 'BDT', 'mobile_money', 20000, date '2026-01-01', true)
on conflict (owner_id, name) do nothing;

insert into public.finance_categories (owner_id, name, kind, is_active)
select '00000000-0000-4000-8000-000000000001'::uuid, v.name, v.kind, true
from (values
  ('Salary'::text, 'income'::text),
  ('Freelance', 'income'),
  ('Food', 'expense'),
  ('Housing', 'expense')
) as v(name, kind)
where not exists (
  select 1 from public.finance_categories fc
  where fc.owner_id = '00000000-0000-4000-8000-000000000001'
    and fc.name = v.name
    and fc.kind = v.kind
);

insert into public.contacts (
  id, owner_id, full_name, contact_type, phone, email, country_code
)
values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Example Foundation', 'organization', '+8801000000001', 'hello@example.org', 'BD'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'Example Friend', 'individual', '+8801000000002', 'friend@example.org', 'BD')
on conflict (id) do nothing;

commit;
