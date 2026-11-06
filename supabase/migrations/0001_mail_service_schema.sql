-- Already applied to the Supabase project via the Supabase connector.
-- Kept here so the schema is versioned with the code and can be recreated in another project.
-- All tables are prefixed mail_ so they don't collide with other apps in the same project.

create table public.mail_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'sender' check (role in ('sender', 'courier')),
  created_at timestamptz not null default now()
);

create table public.mail_deliveries (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  sender_id uuid not null references auth.users(id) on delete restrict,
  courier_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  tariff text not null,
  parcel_size text not null,
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  recipient_name text not null,
  recipient_phone text,
  notes text,
  distance_km numeric(6, 2) not null,
  zone text not null,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  promo_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index mail_deliveries_sender_idx on public.mail_deliveries (sender_id, created_at desc);
create index mail_deliveries_status_idx on public.mail_deliveries (status, created_at desc);
create index mail_deliveries_courier_idx on public.mail_deliveries (courier_id);

create table public.mail_status_events (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references public.mail_deliveries(id) on delete cascade,
  status text not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index mail_status_events_delivery_idx on public.mail_status_events (delivery_id, created_at);

create table public.mail_promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null unique references public.mail_deliveries(id) on delete cascade,
  discount_cents integer not null,
  created_at timestamptz not null default now()
);
create index mail_promo_redemptions_code_idx on public.mail_promo_redemptions (code, sender_id);

alter table public.mail_profiles enable row level security;
alter table public.mail_deliveries enable row level security;
alter table public.mail_status_events enable row level security;
alter table public.mail_promo_redemptions enable row level security;

create function public.mail_is_courier()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mail_profiles
    where id = (select auth.uid()) and role = 'courier'
  );
$$;
revoke all on function public.mail_is_courier() from public, anon;
grant execute on function public.mail_is_courier() to authenticated;

-- Reads only. All writes go through the Next.js API (service role), which validates prices, tariffs and promo codes.
create policy "mail profiles: read own" on public.mail_profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "mail deliveries: sender reads own, couriers read all" on public.mail_deliveries
  for select to authenticated
  using (sender_id = (select auth.uid()) or (select public.mail_is_courier()));

create policy "mail events: visible with the delivery" on public.mail_status_events
  for select to authenticated
  using (exists (select 1 from public.mail_deliveries d where d.id = delivery_id));

create policy "mail promo redemptions: read own" on public.mail_promo_redemptions
  for select to authenticated using (sender_id = (select auth.uid()));
