/** Password update with server-verified assurance and current password. */
import {withSupabase} from 'npm:@supabase/server@1.9.2';
import {json,preflight,allowedRequest,readJSON,verifiedAAL2,responseWithSecurity} from '../_shared/security.ts';
const protectedFetch=withSupabase({auth:'user',cors:'disabled'},async(req,ctx)=>{
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
  if(!allowedRequest(req))return json(req,{error:'Origin not allowed'},403);
  if(!verifiedAAL2(ctx.jwtClaims))return json(req,{error:'MFA verification required'},403);
  const body=await readJSON(req), id=ctx.userClaims?.id;
  if(!id||!body||typeof body.current_password!=='string'||!body.current_password||body.current_password.length>256||
     typeof body.new_password!=='string'||body.new_password.length<15||body.new_password.length>256||
     body.current_password===body.new_password)
    return json(req,{error:'Invalid password change request'},400);
  const {data:profile,error:profileErr}=await ctx.supabaseAdmin.auth.admin.getUserById(id);
  if(profileErr||!profile.user?.email)return json(req,{error:'Account lookup failed'},401);
  const {data:verified,error:authErr}=await ctx.supabase.auth.signInWithPassword({
    email:profile.user.email,password:body.current_password
  });
  if(authErr||verified.user?.id!==id)return json(req,{error:'Current account password is incorrect'},403);
  const {error}=await ctx.supabaseAdmin.auth.admin.updateUserById(id,{password:body.new_password});
  if(error)return json(req,{error:'Password update failed'},500);
  return json(req,{changed:true});
});
export default {async fetch(req:Request){
  if(req.method==='OPTIONS')return preflight(req);
  return responseWithSecurity(req,await protectedFetch(req));
}};
