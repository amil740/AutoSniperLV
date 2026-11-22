create extension if not exists pgcrypto;

create table if not exists public.listings_cache (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  make text,
  model text,
  year integer,
  mileage integer,
  engine text,
  price numeric,
  license_plate text,
  description text,
  scraped_at timestamptz not null default now()
);

create index if not exists listings_cache_make_model_year_idx
  on public.listings_cache (make, model, year);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_contact text not null,
  make text,
  model text,
  min_year integer,
  max_price numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_email text,
  telegram_chat_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

alter table public.listings_cache enable row level security;
alter table public.alerts enable row level security;

create policy "Public can read cached listings"
  on public.listings_cache for select
  to anon, authenticated
  using (true);

create policy "Public can create alerts"
  on public.alerts for insert
  to anon, authenticated
  with check (length(trim(user_contact)) > 2);
