-- ============================================================
-- MyCafe Database Schema  (idempotent — safe to re-run)
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

drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

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
  symbol        text not null,
  name          text not null,
  exchange      text not null default 'NSE',
  isin          text,
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

-- Migrate unique constraint: symbol → (symbol, exchange)
do $$ begin
  -- drop old single-column unique if it exists
  if exists (
    select 1 from pg_constraint
    where conname = 'stocks_symbol_key' and conrelid = 'public.stocks'::regclass
  ) then
    alter table public.stocks drop constraint stocks_symbol_key;
  end if;
  -- add composite unique if not exists
  if not exists (
    select 1 from pg_constraint
    where conname = 'stocks_symbol_exchange_key' and conrelid = 'public.stocks'::regclass
  ) then
    alter table public.stocks add constraint stocks_symbol_exchange_key unique (symbol, exchange);
  end if;
  -- drop old isin unique if it exists (same ISIN appears on NSE and BSE)
  if exists (
    select 1 from pg_constraint
    where conname = 'stocks_isin_key' and conrelid = 'public.stocks'::regclass
  ) then
    alter table public.stocks drop constraint stocks_isin_key;
  end if;
end $$;

alter table public.stocks enable row level security;

drop policy if exists "Stocks readable by all authenticated users" on public.stocks;
create policy "Stocks readable by all authenticated users"
  on public.stocks for select to authenticated using (true);

create index if not exists idx_stocks_symbol   on public.stocks(symbol);
create index if not exists idx_stocks_exchange on public.stocks(exchange);
create index if not exists idx_stocks_sector   on public.stocks(sector);
create index if not exists idx_stocks_name_fts on public.stocks using gin(to_tsvector('english', name));

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

drop policy if exists "Mutual funds readable by all authenticated users" on public.mutual_funds;
create policy "Mutual funds readable by all authenticated users"
  on public.mutual_funds for select to authenticated using (true);

create index if not exists idx_mf_scheme_code on public.mutual_funds(scheme_code);
create index if not exists idx_mf_category    on public.mutual_funds(category);
create index if not exists idx_mf_amc         on public.mutual_funds(amc);
create index if not exists idx_mf_name_fts    on public.mutual_funds using gin(to_tsvector('english', name));

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

drop policy if exists "Users can view own transactions"   on public.portfolio_transactions;
drop policy if exists "Users can insert own transactions" on public.portfolio_transactions;
drop policy if exists "Users can update own transactions" on public.portfolio_transactions;
drop policy if exists "Users can delete own transactions" on public.portfolio_transactions;
create policy "Users can view own transactions"   on public.portfolio_transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on public.portfolio_transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions" on public.portfolio_transactions for update using (auth.uid() = user_id);
create policy "Users can delete own transactions" on public.portfolio_transactions for delete using (auth.uid() = user_id);

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

drop policy if exists "Users can view own holdings"   on public.portfolio_holdings;
drop policy if exists "Users can insert own holdings" on public.portfolio_holdings;
drop policy if exists "Users can update own holdings" on public.portfolio_holdings;
drop policy if exists "Users can delete own holdings" on public.portfolio_holdings;
create policy "Users can view own holdings"   on public.portfolio_holdings for select using (auth.uid() = user_id);
create policy "Users can insert own holdings" on public.portfolio_holdings for insert with check (auth.uid() = user_id);
create policy "Users can update own holdings" on public.portfolio_holdings for update using (auth.uid() = user_id);
create policy "Users can delete own holdings" on public.portfolio_holdings for delete using (auth.uid() = user_id);

create index if not exists idx_ph_user_id on public.portfolio_holdings(user_id);

-- ── Watchlists ───────────────────────────────────────────────
create table if not exists public.watchlists (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'My Watchlist',
  created_at  timestamptz default now()
);

alter table public.watchlists enable row level security;

drop policy if exists "Users can manage own watchlists" on public.watchlists;
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

drop policy if exists "Users can manage own watchlist items" on public.watchlist_items;
create policy "Users can manage own watchlist items"
  on public.watchlist_items for all
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
  ));

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

drop policy if exists "Users can manage own alerts" on public.alerts;
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

drop policy if exists "Authenticated users can read fundamentals cache" on public.fundamentals_cache;
drop policy if exists "Service role can write fundamentals cache"        on public.fundamentals_cache;
create policy "Authenticated users can read fundamentals cache"
  on public.fundamentals_cache for select to authenticated using (true);
create policy "Service role can write fundamentals cache"
  on public.fundamentals_cache for all to service_role using (true) with check (true);

-- ── Stock Fundamentals ───────────────────────────────────────
-- Stores daily-refreshed fundamental metrics per stock
create table if not exists public.stock_fundamentals (
  id                  uuid primary key default uuid_generate_v4(),
  symbol              text not null,
  exchange            text not null default 'NSE',
  -- 52-week range
  week52_high         numeric,
  week52_low          numeric,
  week52_range_pct    numeric,  -- where current price sits in the 52W range (0-100)
  -- Valuation
  pe_ratio            numeric,  -- trailing P/E
  forward_pe          numeric,
  pb_ratio            numeric,  -- price-to-book
  eps                 numeric,  -- trailing EPS (INR)
  eps_forward         numeric,
  -- Dividend
  dividend_yield      numeric,  -- %
  dividend_rate       numeric,  -- annual dividend per share (INR)
  ex_dividend_date    date,
  last_dividend_value numeric,  -- most recent dividend per share (INR)
  last_dividend_date  date,
  -- Other key metrics
  market_cap          numeric,
  beta                numeric,
  roe                 numeric,  -- return on equity %
  debt_to_equity      numeric,
  revenue             numeric,
  net_income          numeric,
  analyst_target      numeric,
  recommendation      text,
  -- Meta
  fetched_at          timestamptz default now(),
  unique(symbol, exchange)
);

alter table public.stock_fundamentals enable row level security;

drop policy if exists "Anyone can read stock fundamentals" on public.stock_fundamentals;
drop policy if exists "Service role can write stock fundamentals" on public.stock_fundamentals;
create policy "Anyone can read stock fundamentals"
  on public.stock_fundamentals for select to authenticated using (true);
create policy "Service role can write stock fundamentals"
  on public.stock_fundamentals for all to service_role using (true) with check (true);

create index if not exists idx_sf_symbol   on public.stock_fundamentals(symbol);
create index if not exists idx_sf_exchange on public.stock_fundamentals(exchange);

-- ── Stock Dividends ──────────────────────────────────────────
-- Historical dividend payments per stock
create table if not exists public.stock_dividends (
  id          uuid primary key default uuid_generate_v4(),
  symbol      text not null,
  exchange    text not null default 'NSE',
  amount      numeric not null,   -- dividend per share (INR)
  ex_date     date not null,
  pay_date    date,
  div_type    text default 'Cash', -- Cash / Special / Stock
  created_at  timestamptz default now(),
  unique(symbol, exchange, ex_date)
);

alter table public.stock_dividends enable row level security;

drop policy if exists "Anyone can read stock dividends" on public.stock_dividends;
drop policy if exists "Service role can write stock dividends" on public.stock_dividends;
create policy "Anyone can read stock dividends"
  on public.stock_dividends for select to authenticated using (true);
create policy "Service role can write stock dividends"
  on public.stock_dividends for all to service_role using (true) with check (true);

create index if not exists idx_sd_symbol   on public.stock_dividends(symbol, exchange);
create index if not exists idx_sd_ex_date  on public.stock_dividends(ex_date desc);

-- ── Updated-at triggers ──────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
drop trigger if exists trg_stocks_updated_at   on public.stocks;
drop trigger if exists trg_mf_updated_at       on public.mutual_funds;
drop trigger if exists trg_holdings_updated_at on public.portfolio_holdings;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_stocks_updated_at before update on public.stocks
  for each row execute function public.set_updated_at();
create trigger trg_mf_updated_at before update on public.mutual_funds
  for each row execute function public.set_updated_at();
create trigger trg_holdings_updated_at before update on public.portfolio_holdings
  for each row execute function public.set_updated_at();
