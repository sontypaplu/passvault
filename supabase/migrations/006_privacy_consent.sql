-- AVENLOCK privacy acknowledgement, versioned and isolated per authenticated user.
-- Apply in Supabase SQL Editor BEFORE deploying the new onboarding UI.
-- Account deletion cascades to remove acknowledgement rows.
create table if not exists public.privacy_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null check (policy_version = '2026-11-18-v1'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_version)
);
alter table public.privacy_consents enable row level security;
revoke all on table public.privacy_consents from public, anon, authenticated;
grant select on public.privacy_consents to authenticated;
grant insert (user_id, policy_version) on public.privacy_consents to authenticated;
create policy "privacy_read_own" on public.privacy_consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "privacy_accept_own" on public.privacy_consents
  for insert to authenticated with check (user_id = (select auth.uid()));
