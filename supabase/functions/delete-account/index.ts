/** Account deletion requires MFA AAL2, current password, and typed confirmation. */
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import {json,preflight,allowedRequest,readJSON,verifiedAAL2,responseWithSecurity} from '../_shared/security.ts';
const protectedFetch=withSupabase({auth:'user',cors:'disabled'},async(req,ctx)=>{
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
  if(!allowedRequest(req))return json(req,{error:'Origin not allowed'},403);
  if(!verifiedAAL2(ctx.jwtClaims))return json(req,{error:'MFA verification required'},403);
  const body=await readJSON(req), id=ctx.userClaims?.id;
  if(!id||!body||body.confirm!=='DELETE MY ACCOUNT'||typeof body.account_password!=='string'||
     !body.account_password||body.account_password.length>256)
    return json(req,{error:'Invalid deletion confirmation'},400);
  const {data:profile,error:profileErr}=await ctx.supabaseAdmin.auth.admin.getUserById(id);
  if(profileErr||!profile.user?.email)return json(req,{error:'Account lookup failed'},401);
  const {data:verified,error:authErr}=await ctx.supabase.auth.signInWithPassword({
    email:profile.user.email,password:body.account_password
  });
  if(authErr||verified.user?.id!==id)return json(req,{error:'Current account password is incorrect'},403);
  const {error:avatarError}=await ctx.supabaseAdmin.storage.from('passvault-avatars')
    .remove([`${id}/avatar.webp`]);
  if(avatarError&&!(/not found|does not exist|no such bucket/i.test(avatarError.message||'')||
     String(avatarError.status||avatarError.statusCode||'')==='404'))
    return json(req,{error:'Account cleanup failed. Account not deleted.'},500);
  const {error}=await ctx.supabaseAdmin.auth.admin.deleteUser(id);
  if(error)return json(req,{error:'Account deletion failed. Contact support.'},500);
  return json(req,{deleted:true});
});
export default {async fetch(req:Request){
  if(req.method==='OPTIONS')return preflight(req);
  return responseWithSecurity(req,await protectedFetch(req));
}};
