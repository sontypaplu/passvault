-- PassVault 2.0 deletion repair after public.vaults was accidentally dropped.
-- Safe to run on a database with the working public.vault_items table.
-- Does NOT delete, modify, or re-encrypt any vault record when installed.
-- Requires public.vault_items and Supabase's service_role database role.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_multi_vault_as_admin(
  p_user_id uuid,
  p_vault_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_legacy_user_id uuid;
BEGIN
  SELECT legacy_user_id INTO v_legacy_user_id
  FROM public.vault_items
  WHERE user_id = p_user_id AND vault_id = p_vault_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Older installations retain public.vaults; newer ones may not.
  -- Dynamic SQL avoids referencing a relation that may not exist.
  IF v_legacy_user_id IS NOT NULL
     AND to_regclass('public.vaults') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.vaults WHERE user_id = $1 AND user_id = $2'
      USING p_user_id, v_legacy_user_id;
  END IF;

  DELETE FROM public.vault_items
  WHERE user_id = p_user_id AND vault_id = p_vault_id;

  RETURN FOUND;
END;
$$;

-- Keep this privileged routine inaccessible to normal web clients.
REVOKE ALL ON FUNCTION public.delete_multi_vault_as_admin(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_multi_vault_as_admin(uuid,uuid)
  TO service_role;

COMMIT;
