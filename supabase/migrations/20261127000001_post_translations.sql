-- Optional English translation for blog posts. The original columns remain the
-- primary (Bangla) version, so existing posts and feeds keep working unchanged.

alter table public.posts
  add column if not exists title_en text,
  add column if not exists excerpt_en text,
  add column if not exists content_md_en text;

comment on column public.posts.title_en is 'Optional English title for the article language toggle';
comment on column public.posts.excerpt_en is 'Optional English summary for the article language toggle';
comment on column public.posts.content_md_en is 'Optional English Markdown body for the article language toggle';
