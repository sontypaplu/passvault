-- MFA enforcement for secret ciphertext. Apply AFTER shipping MFA enrollment and
-- challenge UI. Existing encrypted contents are untouched. Users must enroll
-- TOTP before reading or saving vaults. Test in a staging clone first.
BEGIN;
-- Preserve the normal positive ownership policy. Restrictive ownership+MFA
-- policy applies in addition to ALL permissive SELECT policies, including ones
-- that may be added to a pre-existing database by other migrations.
DROP POLICY IF EXISTS vault_items_select_own ON public.vault_items;
CREATE POLICY vault_items_select_own ON public.vault_items
AS PERMISSIVE FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS vault_items_owner_mfa_gate ON public.vault_items;
CREATE POLICY vault_items_owner_mfa_gate ON public.vault_items
AS RESTRICTIVE FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id AND (auth.jwt()->>'aal') = 'aal2');

-- Re-establish the authenticated client CAS API with server-trusted assurance.
CREATE OR REPLACE FUNCTION public.save_multi_vault(
  p_vault_id uuid, p_encrypted_vault jsonb, p_expected_revision bigint, p_label text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_revision bigint;
BEGIN
  IF v_user_id IS NULL OR (SELECT auth.role()) <> 'authenticated'
     OR (auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'mfa_required: verify a second factor first' USING ERRCODE='28000';
  END IF;
  IF p_vault_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0
     OR p_label IS NULL OR char_length(trim(p_label)) NOT BETWEEN 1 AND 80
     OR p_encrypted_vault IS NULL OR jsonb_typeof(p_encrypted_vault) <> 'object'
     OR octet_length(p_encrypted_vault::text) > 2097152 THEN
    RAISE EXCEPTION 'Invalid encrypted vault parameters' USING ERRCODE='22023';
  END IF;
  SELECT revision INTO v_revision FROM public.vault_items
    WHERE vault_id=p_vault_id AND user_id=v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_revision <> 0 THEN
      RAISE EXCEPTION 'vault_conflict: vault not found or not owned' USING ERRCODE='40001';
    END IF;
    INSERT INTO public.vault_items (vault_id,user_id,label,encrypted_vault,revision)
      VALUES (p_vault_id,v_user_id,trim(p_label),p_encrypted_vault,1);
    RETURN 1;
  END IF;
  IF v_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'vault_conflict: newer revision exists' USING ERRCODE='40001';
  END IF;
  UPDATE public.vault_items SET encrypted_vault=p_encrypted_vault,
    revision=v_revision+1,updated_at=now(),label=trim(p_label)
    WHERE vault_id=p_vault_id AND user_id=v_user_id;
  RETURN v_revision+1;
END;
$$;
REVOKE ALL ON FUNCTION public.save_multi_vault(uuid,jsonb,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_multi_vault(uuid,jsonb,bigint,text) TO authenticated;
COMMIT;
