-- Graffiti Studio community gallery
-- Anyone can browse and publish artwork; no accounts required (anon-safe RLS).

create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  artist text not null default 'Anonymous',
  image_path text not null, -- object path inside the 'artwork' storage bucket
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index if not exists artworks_created_at_idx on public.artworks (created_at desc);

alter table public.artworks enable row level security;

drop policy if exists "Anyone can view artworks" on public.artworks;
create policy "Anyone can view artworks"
  on public.artworks for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can publish artworks" on public.artworks;
create policy "Anyone can publish artworks"
  on public.artworks for insert
  to anon, authenticated
  with check (true);

-- public storage bucket for exported pieces
insert into storage.buckets (id, name, public)
values ('artwork', 'artwork', true)
on conflict (id) do nothing;

drop policy if exists "Public artwork uploads" on storage.objects;
create policy "Public artwork uploads"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'artwork');

drop policy if exists "Public artwork reads" on storage.objects;
create policy "Public artwork reads"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'artwork');
