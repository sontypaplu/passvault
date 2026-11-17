/** Irreversible account deletion requires fresh account-password verification. */
import { withSupabase } from 'npm:@supabase/server@1';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => Response.json(body, {status, headers: {...cors, 'Cache-Control': 'no-store'}});
const protectedFetch = withSupabase({auth:'user'}, async(req,ctx) => {
  if (req.method !== 'POST') return json({error:'Method not allowed'},405);
  let body: { account_password?: string; confirm?: string };
  try { body = await req.json(); } catch {return json({error:'Invalid JSON'},400);}
  const id = ctx.userClaims?.id;
  if (!id || body.confirm !== 'DELETE MY ACCOUNT' || typeof body.account_password !== 'string' || !body.account_password)
    return json({error:'Missing deletion confirmation'},400);
  const {data: profile, error: profileErr} = await ctx.supabaseAdmin.auth.admin.getUserById(id);
  if (profileErr || !profile.user?.email) return json({error:'Account lookup failed'},401);
  const {data: verified, error: authErr} = await ctx.supabase.auth.signInWithPassword({email: profile.user.email, password: body.account_password});
  if (authErr || verified.user?.id !== id) return json({error:'Current account password is incorrect'},403);
  // Remove the private avatar first. Deleting auth.users does not implicitly
  // delete Storage objects. Treat non-existent files as harmless, but fail if
  // cleanup returns an error so private account data is not orphaned.
  const {error: avatarError} = await ctx.supabaseAdmin.storage
    .from('passvault-avatars').remove([`${id}/avatar.webp`]);
  // The avatar feature is optional on older projects. If its bucket was never
  // created there is nothing to clean up; all other Storage errors fail closed.
  if (avatarError && !(/not found|does not exist|no such bucket/i.test(avatarError.message || '') ||
      String(avatarError.status || avatarError.statusCode || '') === '404')) {
    return json({error:'Account data cleanup failed; account was not deleted'},500);
  }
  // Both legacy vaults and vault_items use ON DELETE CASCADE referencing auth.users.
  const {error} = await ctx.supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return json({error:'Account deletion failed; please contact support'},500);
  return json({deleted:true});
});
export default {async fetch(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, {headers:cors});
  const res = await protectedFetch(req);
  const headers = new Headers(res.headers); Object.entries(cors).forEach(([k,v])=>headers.set(k,v)); headers.set('Cache-Control','no-store');
  return new Response(res.body, {status:res.status,headers});
}};
