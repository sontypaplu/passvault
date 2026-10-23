/** Server-only deletion. Never expose Supabase secret keys to the browser. */
import { withSupabase } from 'npm:@supabase/server@1';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => Response.json(body, {status, headers: {...cors, 'Cache-Control': 'no-store'}});
const protectedFetch = withSupabase({auth: 'user'}, async (req, ctx) => {
  if (req.method !== 'POST') return json({error:'Method not allowed'}, 405);
  let body: { vault_id?: string; account_password?: string; confirm?: string };
  try { body = await req.json(); } catch { return json({error:'Invalid JSON'},400); }
  const id = ctx.userClaims?.id;
  const vaultId = body.vault_id;
  if (!id || !vaultId || !/^[0-9a-f-]{36}$/i.test(vaultId) || body.confirm !== 'DELETE VAULT' ||
      typeof body.account_password !== 'string' || !body.account_password) {
    return json({error:'Missing deletion confirmation'},400);
  }
  const {data: profile, error: profileErr} = await ctx.supabaseAdmin.auth.admin.getUserById(id);
  if (profileErr || !profile.user?.email) return json({error:'Account lookup failed'},401);
  // A separate authenticated password check; the browser's password field isn't trusted.
  const {data: verified, error: authErr} = await ctx.supabase.auth.signInWithPassword({
    email: profile.user.email, password: body.account_password
  });
  if (authErr || verified.user?.id !== id) return json({error:'Current account password is incorrect'},403);
  // Atomic database routine also removes the retained v1 copy for a migrated vault.
  // Only the service-role backend client can execute this RPC.
  const {data: deleted, error} = await ctx.supabaseAdmin.rpc('delete_multi_vault_as_admin', {
    p_user_id: id, p_vault_id: vaultId
  });
  if (error) return json({error:'Deletion failed'},500);
  if (!deleted) return json({error:'Vault not found'},404);
  return json({deleted:true});
});
export default { async fetch(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, {headers:cors});
  const res = await protectedFetch(req);
  const headers = new Headers(res.headers); Object.entries(cors).forEach(([k,v])=>headers.set(k,v)); headers.set('Cache-Control','no-store');
  return new Response(res.body, {status:res.status, headers});
}};
