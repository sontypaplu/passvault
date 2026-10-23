-- PassVault 3.0: apply ONCE in Supabase SQL Editor AFTER exporting a backup.
-- This is a non-destructive limit on NEW creations only; existing rows are untouched.
-- Does not refer to the removed public.vaults legacy table.
-- The trigger protects the data layer even if callers bypass the UI or the save RPC.
BEGIN;

-- Keep privileged trigger logic outside exposed API schemas.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.enforce_two_vault_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Vault must belong to an account' USING ERRCODE='23502';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
      RETURN NEW;
    END IF;
  END IF;
  -- A transaction-level, per-account advisory lock serializes concurrent creates.
  -- hashtextextended collisions only reduce concurrency; they cannot permit bypass.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text, 330));
  IF (SELECT count(*) FROM public.vault_items
      WHERE user_id = NEW.user_id AND vault_id <> NEW.vault_id) >= 2 THEN
    RAISE EXCEPTION 'vault_limit_reached: maximum 2 vaults per account'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_two_vault_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS vault_items_two_vault_limit ON public.vault_items;
CREATE TRIGGER vault_items_two_vault_limit
BEFORE INSERT OR UPDATE OF user_id ON public.vault_items
FOR EACH ROW EXECUTE FUNCTION private.enforce_two_vault_limit();

COMMIT;

-- Optional READ-ONLY check after deployment:
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgrelid = 'public.vault_items'::regclass AND tgname = 'vault_items_two_vault_limit';
