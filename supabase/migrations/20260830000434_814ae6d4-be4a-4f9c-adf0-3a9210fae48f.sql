-- ENUMS
create type public.app_role as enum ('admin','user');
create type public.banner_placement as enum ('landing','login','register','dashboard','global');
create type public.commission_source as enum ('deposit','game_loss','manual');
create type public.commission_status as enum ('pending','available','paid','canceled');
create type public.deposit_status as enum ('pending','paid','failed','rejected','canceled');
create type public.game_session_status as enum ('active','lost','cashed_out','won');
create type public.wallet_kind as enum ('player','affiliate');
create type public.wallet_tx_type as enum ('bet','win','deposit','commission','withdrawal_player','withdrawal_affiliate','withdrawal_refund','admin_credit_player','admin_debit_player','admin_credit_affiliate','admin_debit_affiliate');
create type public.webhook_processing_status as enum ('received','processed','ignored','error');
create type public.withdrawal_status as enum ('pending','approved','processing','rejected','paid','canceled');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  user_id uuid primary key,
  email text not null,
  full_name text not null default '',
  username text,
  cpf text,
  phone text,
  referral_code text unique,
  referred_by uuid,
  is_influencer boolean not null default false,
  comissao_cpa numeric,
  comissao_cpa_nivel2 numeric,
  custom_bonus_percent numeric,
  custom_coin_return numeric,
  custom_commission_percent numeric,
  custom_game_difficulty numeric,
  custom_game_speed numeric,
  custom_jump_height numeric,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin');
$$;

create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = user_id or public.is_admin());
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "user_roles_select_own" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.is_admin());

create table public.wallets (
  user_id uuid primary key,
  player_balance numeric not null default 0,
  affiliate_balance numeric not null default 0,
  comissao_disponivel numeric not null default 0,
  total_affiliate_earned numeric not null default 0,
  total_deposited numeric not null default 0,
  total_withdrawn numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "wallets_select_own" on public.wallets for select to authenticated using (auth.uid() = user_id or public.is_admin());
create trigger wallets_updated_at before update on public.wallets for each row execute function public.set_updated_at();

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  admin_id uuid,
  amount numeric not null,
  bonus_amount numeric not null default 0,
  total_credited numeric,
  provider text not null default 'onixpay',
  gateway text,
  status public.deposit_status not null default 'pending',
  pix_code text,
  qr_code text,
  qr_code_image_url text,
  payment_link text,
  transaction_id text,
  external_id text,
  metadata jsonb,
  payload jsonb,
  response jsonb,
  paid_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.deposits to authenticated;
grant all on public.deposits to service_role;
alter table public.deposits enable row level security;
create policy "deposits_select_own" on public.deposits for select to authenticated using (auth.uid() = user_id or public.is_admin());
create trigger deposits_updated_at before update on public.deposits for each row execute function public.set_updated_at();

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  admin_id uuid,
  amount numeric not null,
  fee_amount numeric not null default 0,
  net_amount numeric not null default 0,
  wallet_type public.wallet_kind not null default 'player',
  status public.withdrawal_status not null default 'pending',
  pix_key text,
  pix_key_type text,
  notes text,
  transaction_id text,
  external_id text,
  response jsonb,
  paid_at timestamptz,
  processed_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.withdrawals to authenticated;
grant all on public.withdrawals to service_role;
alter table public.withdrawals enable row level security;
create policy "withdrawals_select_own" on public.withdrawals for select to authenticated using (auth.uid() = user_id or public.is_admin());
create trigger withdrawals_updated_at before update on public.withdrawals for each row execute function public.set_updated_at();

create table public.wallet_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  admin_id uuid,
  type public.wallet_tx_type not null,
  amount numeric not null,
  balance_before numeric not null,
  balance_after numeric not null,
  description text,
  reason text,
  game_session_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;
create policy "wallet_tx_select_own" on public.wallet_transactions for select to authenticated using (auth.uid() = user_id or public.is_admin());

create table public.affiliate_commissions (
  id bigint generated always as identity primary key,
  affiliate_user_id uuid not null,
  referred_user_id uuid not null,
  amount numeric not null,
  source_type public.commission_source not null default 'deposit',
  source_id text,
  status public.commission_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.affiliate_commissions to authenticated;
grant all on public.affiliate_commissions to service_role;
alter table public.affiliate_commissions enable row level security;
create policy "commissions_select_own" on public.affiliate_commissions for select to authenticated using (auth.uid() = affiliate_user_id or public.is_admin());
create trigger commissions_updated_at before update on public.affiliate_commissions for each row execute function public.set_updated_at();

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  bet_amount numeric not null,
  coin_value numeric not null,
  coin_return numeric not null default 0,
  coins_collected integer not null default 0,
  difficulty numeric not null default 1,
  game_speed numeric not null default 1,
  jump_height numeric not null default 1,
  max_payout_amount numeric not null,
  payout_amount numeric not null default 0,
  target_amount numeric not null,
  status public.game_session_status not null default 'active',
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.game_sessions to authenticated;
grant all on public.game_sessions to service_role;
alter table public.game_sessions enable row level security;
create policy "sessions_select_own" on public.game_sessions for select to authenticated using (auth.uid() = user_id or public.is_admin());
create trigger sessions_updated_at before update on public.game_sessions for each row execute function public.set_updated_at();

create table public.webhook_logs (
  id bigint generated always as identity primary key,
  provider text not null,
  event_type text,
  external_id text,
  payload jsonb,
  signature text,
  status_code integer,
  processing_status public.webhook_processing_status not null default 'received',
  created_at timestamptz not null default now()
);
grant all on public.webhook_logs to service_role;
grant select on public.webhook_logs to authenticated;
alter table public.webhook_logs enable row level security;
create policy "webhook_logs_admin" on public.webhook_logs for select to authenticated using (public.is_admin());

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  title text,
  subtitle text,
  placement public.banner_placement not null default 'landing',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.banners to anon;
grant select on public.banners to authenticated;
grant all on public.banners to service_role;
alter table public.banners enable row level security;
create policy "banners_public_read" on public.banners for select using (is_active);
create trigger banners_updated_at before update on public.banners for each row execute function public.set_updated_at();

create table public.game_settings (
  id uuid primary key default gen_random_uuid(),
  game_title text not null default 'Panda Jump',
  game_subtitle text not null default 'Pule, colete e ganhe',
  coin_frequency numeric not null default 1,
  coin_return numeric not null default 1,
  common_player_coin_percentage numeric not null default 50,
  difficulty numeric not null default 1,
  difficulty_per_level numeric not null default 0.1,
  difficulty_rtp_balance numeric not null default 50,
  game_speed numeric not null default 1,
  jump_height numeric not null default 1,
  moving_platform_speed_multiplier numeric not null default 1,
  progressive_distance_multiplier numeric not null default 1,
  rtp_global numeric not null default 90,
  spring_boost numeric not null default 1.5,
  spring_frequency numeric not null default 0.1,
  login_banner_url text,
  register_banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.character_settings (
  id uuid primary key default gen_random_uuid(),
  character_name text not null default 'Panda',
  character_image_url text,
  bg_music_enabled boolean not null default true,
  bg_music_url text,
  coin_sound_url text,
  jump_sound_url text,
  land_sound_url text,
  spring_sound_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.financial_settings (
  id uuid primary key default gen_random_uuid(),
  pix_enabled boolean not null default true,
  min_deposit numeric not null default 10,
  min_withdrawal_player numeric not null default 50,
  min_withdrawal_affiliate numeric not null default 50,
  withdrawal_fee_percent numeric not null default 0,
  withdrawal_fee_fixed numeric not null default 0,
  deposit_bonus_enabled boolean not null default false,
  deposit_bonus_percent numeric not null default 0,
  deposit_bonus_min_amount numeric not null default 0,
  deposit_card_1 numeric default 20,
  deposit_card_2 numeric default 50,
  deposit_card_3 numeric default 100,
  deposit_card_4 numeric default 200,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.commission_settings (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default true,
  default_commission_percent numeric not null default 10,
  default_commission_percent_level2 numeric not null default 0,
  first_deposit_only boolean not null default false,
  min_deposit_for_commission numeric not null default 0,
  affiliate_skip_interval integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.influencer_settings (
  id uuid primary key default gen_random_uuid(),
  coin_return numeric not null default 1,
  difficulty_reduction numeric not null default 0,
  gain_multiplier numeric not null default 1,
  jump_multiplier numeric not null default 1,
  influencer_calculation_mode text not null default 'multiplier',
  influencer_coin_percentage numeric not null default 100,
  influencer_double_coins_v2 boolean not null default false,
  influencer_fixed_coin_value_v2 numeric not null default 0,
  influencer_jump_multiplier_v2 numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.onixpay_config (
  id uuid primary key default gen_random_uuid(),
  api_base_url text,
  deposit_callback_url text,
  withdrawal_callback_url text,
  is_active boolean not null default true,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['game_settings','character_settings','financial_settings','commission_settings','influencer_settings','onixpay_config']
  loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_read" on public.%I for select using (true)', t, t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t||'_updated_at', t);
  end loop;
end $$;

insert into public.game_settings default values;
insert into public.character_settings default values;
insert into public.financial_settings default values;
insert into public.commission_settings default values;
insert into public.influencer_settings default values;
insert into public.onixpay_config default values;

create table public.admin_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null,
  action text not null,
  target_user_id uuid,
  ip_address text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
grant select on public.admin_logs to authenticated;
grant all on public.admin_logs to service_role;
alter table public.admin_logs enable row level security;
create policy "admin_logs_admin_read" on public.admin_logs for select to authenticated using (public.is_admin());

create or replace function public.grant_owner_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(new.email,'')) = 'detroit.system@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.user_id, 'admin'::public.app_role)
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end $$;

create trigger profiles_grant_owner_admin
after insert or update of email on public.profiles
for each row execute function public.grant_owner_admin();