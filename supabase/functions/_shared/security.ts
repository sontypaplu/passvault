/** Request validation only; authentication remains with withSupabase({auth:'user'}).
 * ALLOWED_ORIGINS must list the actual https:// frontend origins, comma-separated.
 * Do not include passwords, JWTs, vault envelopes or TOTP secrets in logs.
 */
const allowedOrigins = () => new Set((Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map(value => value.trim()).filter(value => {
    try { const url = new URL(value); return url.origin === value && url.protocol === 'https:'; }
    catch { return false; }
  }));
export function corsFor(req: Request) {
  const origin = req.headers.get('Origin');
  const matched = origin && allowedOrigins().has(origin);
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-runtime',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });
  if (matched) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}
export const json = (req:Request, value:unknown, status=200) =>
  Response.json(value,{status,headers:corsFor(req)});
export const preflight = (req:Request) => {
  if (!req.headers.get('Origin') || !corsFor(req).has('Access-Control-Allow-Origin'))
    return json(req,{error:'Origin not allowed'},403);
  return new Response(null,{status:204,headers:corsFor(req)});
};
export function allowedRequest(req:Request) {
  const origin=req.headers.get('Origin');
  // Non-browser callers with a valid bearer token may omit Origin; CORS is
  // never an authentication mechanism.
  return !origin || corsFor(req).has('Access-Control-Allow-Origin');
}
export async function readJSON(req:Request):Promise<Record<string,unknown>|null> {
  if (req.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return null;
  if (Number(req.headers.get('Content-Length') ?? 0) > 4096) return null;
  const text=await req.text();
  if (text.length>4096) return null;
  try { const body=JSON.parse(text); return body && typeof body==='object' && !Array.isArray(body) ? body:null; }
  catch { return null; }
}
export const verifiedAAL2 = (claims: {aal?:unknown}|undefined|null) => claims?.aal==='aal2';
export function responseWithSecurity(req:Request, original:Response) {
  const headers=new Headers(original.headers);
  corsFor(req).forEach((value,key)=>headers.set(key,value));
  return new Response(original.body,{status:original.status,headers});
}
