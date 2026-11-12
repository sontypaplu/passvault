-- Baseline-compatible v2 migration. Compare original migration in docs/PRE_HARDENING_AUDIT.md and the source archive.
-- DO NOT manually rerun against production; apply using the migration ledger.
-- PassVault v2: non-destructive multi-vault migration. Run ONCE AFTER BACKING UP.
-- Original public.vaults (one vault per user) is kept untouched.
-- Its encrypted_vault JSON is copied without decryption or re-encryption.
begin;

create table if not exists public.vault_items (
  vault_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Vault' check (char_length(label) between 1 and 80),
  encrypted_vault jsonb not null check (jsonb_typeof(encrypted_vault) = 'object' and octet_length(encrypted_vault::text) <= 2097152),
  revision bigint not null default 1 check (revision >= 1),
  legacy_user_id uuid unique, -- marks imported v1 records, so reruns never duplicate them
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vault_items_user_id_idx on public.vault_items(user_id);
alter table public.vault_items enable row level security;
revoke all on table public.vault_items from public, anon, authenticated;
grant select on table public.vault_items to authenticated;

-- Copy legacy ciphertext only where the v1 table still exists. This also works on
-- freshly created Supabase projects without a public.vaults relation.
DO $legacy_copy$
BEGIN
  IF to_regclass('public.vaults') IS NOT NULL THEN
    EXECUTE $statement$
      INSERT INTO public.vault_items (user_id,label,encrypted_vault,revision,legacy_user_id,created_at,updated_at)
      SELECT user_id,'Migrated Vault',encrypted_vault,revision,user_id,created_at,updated_at
      FROM public.vaults
      ON CONFLICT (legacy_user_id) DO NOTHING
    $statement$;
  END IF;
END
$legacy_copy$;

-- No client-side insert/update/delete grants; writes must use controlled RPCs or Edge Functions.
drop policy if exists vault_items_select_own on public.vault_items;
create policy vault_items_select_own on public.vault_items
  for select to authenticated using ((select auth.uid()) = user_id);

-- Atomic, account-scoped create/save; no direct UPDATE privilege can bypass revision checks.
create or replace function public.save_multi_vault(
  p_vault_id uuid, p_encrypted_vault jsonb, p_expected_revision bigint, p_label text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_revision bigint;
begin
  if v_user_id is null or (select auth.role()) <> 'authenticated' then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_vault_id is null or p_expected_revision is null or p_expected_revision < 0
     or p_label is null or char_length(trim(p_label)) not between 1 and 80
     or p_encrypted_vault is null or jsonb_typeof(p_encrypted_vault) <> 'object'
     or octet_length(p_encrypted_vault::text) > 2097152 then
    raise exception 'Invalid encrypted vault parameters' using errcode = '22023';
  end if;

  select revision into v_revision from public.vault_items
    where vault_id = p_vault_id and user_id = v_user_id for update;
  if not found then
    if p_expected_revision <> 0 then
      raise exception 'vault_conflict: vault not found or not owned' using errcode = '40001';
    end if;
    insert into public.vault_items (vault_id, user_id, label, encrypted_vault, revision)
      values (p_vault_id, v_user_id, trim(p_label), p_encrypted_vault, 1);
    return 1;
  end if;
  if v_revision <> p_expected_revision then
    raise exception 'vault_conflict: newer revision exists' using errcode = '40001';
  end if;
  update public.vault_items set encrypted_vault = p_encrypted_vault,
    revision = v_revision + 1, updated_at = now(), label = trim(p_label)
    where vault_id = p_vault_id and user_id = v_user_id;
  return v_revision + 1;
end;
$$;
revoke all on function public.save_multi_vault(uuid,jsonb,bigint,text) from public, anon;
grant execute on function public.save_multi_vault(uuid,jsonb,bigint,text) to authenticated;

-- Password-authenticated Edge Function calls this as service_role.
-- Delete both the v2 record AND its retained v1 copy (only for a migrated vault),
-- atomically. Otherwise deleting a "Migrated Vault" would leave an old cloud copy.
create or replace function public.delete_multi_vault_as_admin(p_user_id uuid, p_vault_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_legacy_user_id uuid;
begin
  select legacy_user_id into v_legacy_user_id
  from public.vault_items
  where user_id = p_user_id and vault_id = p_vault_id
  for update;
  if not found then return false; end if;
  if v_legacy_user_id is not null and to_regclass('public.vaults') is not null then
    execute 'delete from public.vaults where user_id = $1 and user_id = $2'
      using p_user_id, v_legacy_user_id;
  end if;
  delete from public.vault_items
    where user_id = p_user_id and vault_id = p_vault_id;
  return true;
end;
$$;
revoke all on function public.delete_multi_vault_as_admin(uuid,uuid) from public, anon, authenticated;
grant execute on function public.delete_multi_vault_as_admin(uuid,uuid) to service_role;

-- Legacy table remains as rollback backup; revoke application writes AFTER copying.
-- This also prevents an outdated v1 website from silently diverging from v2.
DO $legacy_revoke$
BEGIN
  IF to_regclass('public.vaults') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.vaults FROM authenticated';
  END IF;
  IF to_regprocedure('public.save_encrypted_vault(jsonb,bigint)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.save_encrypted_vault(jsonb,bigint) FROM authenticated';
  END IF;
END
$legacy_revoke$;
commit;
