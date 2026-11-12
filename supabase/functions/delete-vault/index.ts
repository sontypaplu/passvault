/** Deletion requires provider-verified AAL2 session PLUS fresh current password. */
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import {json,preflight,allowedRequest,readJSON,verifiedAAL2,responseWithSecurity} from '../_shared/security.ts';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const protectedFetch=withSupabase({auth:'user',cors:'disabled'},async(req,ctx)=>{
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
  if(!allowedRequest(req))return json(req,{error:'Origin not allowed'},403);
  if(!verifiedAAL2(ctx.jwtClaims))return json(req,{error:'MFA verification required'},403);
  const body=await readJSON(req);
  const id=ctx.userClaims?.id;
  if(!id || !body || !UUID.test(String(body.vault_id??'')) || body.confirm!=='DELETE VAULT' ||
     typeof body.account_password!=='string' || body.account_password.length<1 || body.account_password.length>256)
    return json(req,{error:'Invalid deletion confirmation'},400);
  const {data:profile,error:profileErr}=await ctx.supabaseAdmin.auth.admin.getUserById(id);
  if(profileErr||!profile.user?.email)return json(req,{error:'Account lookup failed'},401);
  const {data:verified,error:authErr}=await ctx.supabase.auth.signInWithPassword({
    email:profile.user.email,password:body.account_password
  });
  if(authErr||verified.user?.id!==id)return json(req,{error:'Current account password is incorrect'},403);
  const {data:deleted,error}=await ctx.supabaseAdmin.rpc('delete_multi_vault_as_admin',{
    p_user_id:id,p_vault_id:body.vault_id
  });
  if(error)return json(req,{error:'Deletion failed'},500);
  if(!deleted)return json(req,{error:'Vault not found'},404);
  return json(req,{deleted:true});
});
export default {async fetch(req:Request){
  if(req.method==='OPTIONS')return preflight(req);
  return responseWithSecurity(req,await protectedFetch(req));
}};
