-- ============================================================
-- MyCafe Database Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Profiles ────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  mobile        text,
  broker        text,
  risk_tolerance text check (risk_tolerance in ('Conservative','Moderate','Aggressive')) default 'Moderate',
  time_horizon  text check (time_horizon in ('Short','Medium','Long')) default 'Medium',
  avatar_url    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Stocks ──────────────────────────────────────────────────
create table if not exists public.stocks (
  id            uuid primary key default uuid_generate_v4(),
  symbol        text not null unique,
  name          text not null,
  exchange      text not null default 'NSE',
  isin          text unique,
  sector        text,
  industry      text,
  cap_category  text check (cap_category in ('Large Cap','Mid Cap','Small Cap')),
  market_cap    numeric,
  face_value    numeric default 10,
  lot_size      integer default 1,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.stocks enable row level security;
create policy "Stocks readable by all authenticated users"
  on public.stocks for select to authenticated using (true);

create index if not exists idx_stocks_symbol on public.stocks(symbol);
create index if not exists idx_stocks_name   on public.stocks using gin(to_tsvector('english', name));
create index if not exists idx_stocks_sector on public.stocks(sector);

-- ── Mutual Funds ─────────────────────────────────────────────
create table if not exists public.mutual_funds (
  id            uuid primary key default uuid_generate_v4(),
  scheme_code   text not null unique,
  name          text not null,
  amc           text,
  category      text,
  sub_category  text,
  fund_type     text check (fund_type in ('Open Ended','Close Ended','Interval')),
  nav           numeric,
  nav_date      date,
  aum           numeric,
  expense_ratio numeric,
  min_sip       numeric,
  min_lumpsum   numeric,
  risk_level    text,
  benchmark     text,
  fund_manager  text,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.mutual_funds enable row level security;
create policy "Mutual funds readable by all authenticated users"
  on public.mutual_funds for select to authenticated using (true);

create index if not exists idx_mf_scheme_code on public.mutual_funds(scheme_code);
create index if not exists idx_mf_name        on public.mutual_funds using gin(to_tsvector('english', name));
create index if not exists idx_mf_category    on public.mutual_funds(category);
create index if not exists idx_mf_amc         on public.mutual_funds(amc);

-- ── Portfolio Transactions ───────────────────────────────────
create table if not exists public.portfolio_transactions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  instrument_type text not null check (instrument_type in ('STOCK','MF')),
  instrument_id   uuid not null,
  symbol          text not null,
  company_name    text,
  exchange        text,
  txn_type        text not null check (txn_type in ('BUY','SELL')),
  quantity        numeric not null check (quantity > 0),
  price           numeric not null check (price > 0),
  amount          numeric generated always as (quantity * price) stored,
  brokerage       numeric default 0,
  txn_date        date not null,
  notes           text,
  created_at      timestamptz default now()
);

alter table public.portfolio_transactions enable row level security;

create policy "Users can view own transactions"
  on public.portfolio_transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions"
  on public.portfolio_transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions"
  on public.portfolio_transactions for update using (auth.uid() = user_id);
create policy "Users can delete own transactions"
  on public.portfolio_transactions for delete using (auth.uid() = user_id);

create index if not exists idx_ptxn_user_id on public.portfolio_transactions(user_id);
create index if not exists idx_ptxn_symbol  on public.portfolio_transactions(user_id, symbol);
create index if not exists idx_ptxn_date    on public.portfolio_transactions(txn_date);

-- ── Portfolio Holdings ───────────────────────────────────────
create table if not exists public.portfolio_holdings (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  instrument_type text not null check (instrument_type in ('STOCK','MF')),
  instrument_id   uuid not null,
  symbol          text not null,
  company_name    text,
  exchange        text,
  quantity        numeric not null default 0,
  avg_price       numeric not null default 0,
  invested        numeric not null default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(user_id, instrument_type, instrument_id)
);

alter table public.portfolio_holdings enable row level security;

create policy "Users can view own holdings"
  on public.portfolio_holdings for select using (auth.uid() = user_id);
create policy "Users can insert own holdings"
  on public.portfolio_holdings for insert with check (auth.uid() = user_id);
create policy "Users can update own holdings"
  on public.portfolio_holdings for update using (auth.uid() = user_id);
create policy "Users can delete own holdings"
  on public.portfolio_holdings for delete using (auth.uid() = user_id);

create index if not exists idx_ph_user_id on public.portfolio_holdings(user_id);

-- ── Watchlists ───────────────────────────────────────────────
create table if not exists public.watchlists (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'My Watchlist',
  created_at  timestamptz default now()
);

alter table public.watchlists enable row level security;

create policy "Users can manage own watchlists"
  on public.watchlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Watchlist Items ──────────────────────────────────────────
create table if not exists public.watchlist_items (
  id              uuid primary key default uuid_generate_v4(),
  watchlist_id    uuid not null references public.watchlists(id) on delete cascade,
  instrument_type text not null check (instrument_type in ('STOCK','MF')),
  instrument_id   uuid not null,
  symbol          text not null,
  company_name    text,
  exchange        text,
  added_at        timestamptz default now(),
  unique(watchlist_id, instrument_id)
);

alter table public.watchlist_items enable row level security;

create policy "Users can manage own watchlist items"
  on public.watchlist_items for all
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id
        and w.user_id = auth.uid()
    )
  );

-- ── Alerts ───────────────────────────────────────────────────
create table if not exists public.alerts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  instrument_id   uuid,
  symbol          text not null,
  condition       text not null check (condition in (
                    'price_above','price_below',
                    'change_pct_above','change_pct_below',
                    'volume_spike','high_52w','low_52w')),
  threshold       numeric,
  channel         text not null default 'inapp' check (channel in ('inapp','email','both')),
  repeat_alert    boolean default false,
  is_active       boolean default true,
  triggered_at    timestamptz,
  created_at      timestamptz default now()
);

alter table public.alerts enable row level security;

create policy "Users can manage own alerts"
  on public.alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_alerts_user_id   on public.alerts(user_id);
create index if not exists idx_alerts_is_active on public.alerts(is_active) where is_active = true;

-- ── Fundamentals Cache ───────────────────────────────────────
create table if not exists public.fundamentals_cache (
  symbol      text primary key,
  data        jsonb not null,
  fetched_at  timestamptz default now()
);

alter table public.fundamentals_cache enable row level security;
create policy "Authenticated users can read fundamentals cache"
  on public.fundamentals_cache for select to authenticated using (true);
create policy "Service role can write fundamentals cache"
  on public.fundamentals_cache for all to service_role using (true) with check (true);

-- ── Updated-at trigger ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_stocks_updated_at
  before update on public.stocks
  for each row execute function public.set_updated_at();

create trigger trg_mf_updated_at
  before update on public.mutual_funds
  for each row execute function public.set_updated_at();

create trigger trg_holdings_updated_at
  before update on public.portfolio_holdings
  for each row execute function public.set_updated_at();
