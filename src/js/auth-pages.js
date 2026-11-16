/* Public authentication pages: no passwords or tokens are written to URL or storage. */
(() => {
  'use strict';
  const allowed = ['signin', 'signup', 'forgot', 'verify', 'reset'];
  const get = id => document.getElementById(id);
  const recoveryCallback = /(?:^|[&#?])type=recovery(?:&|$)/.test(location.hash + '&' + location.search);
  let recoveryPending = recoveryCallback;
  let recoveryVerified = false;
  function route(page, push = true) {
    const next = allowed.includes(page) ? page : 'signin';
    if(next === 'reset' && !recoveryPending) return route('forgot', push);
    document.querySelectorAll('[data-auth-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.authPanel !== next));
    document.querySelectorAll('#loginView input[type="password"]').forEach(input => { if(!input.closest(`[data-auth-panel="${next}"]`)) input.value = ''; });
    const url = new URL(location.href);
    if(next === 'signin') url.searchParams.delete('auth'); else url.searchParams.set('auth', next);
    if(push && url.href !== location.href) history.pushState({pvAuth:next}, '', url);
    document.title = `${({signin:'Sign in',signup:'Create account',forgot:'Forgot password',verify:'Verify email',reset:'Reset password'})[next]} | PassVault`;
    window.scrollTo({top:0,behavior:'instant'});
  }
  function status(id, text, kind) { setStatus(get(id), text, kind); }
  function redirectUrl() { return location.origin + location.pathname; }
  function copyEmail(from,to) { const value=get(from)?.value?.trim(); if(value) get(to).value=value; }
  function busy(form,yes) { form.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=yes); }
  async function signup(e) {
    e.preventDefault();
    const email=get('signUpEmail').value.trim().toLowerCase();
    const password=get('signUpPassword').value;
    if(password.length<12 || password!==get('signUpConfirm').value) return status('signUpStatus', 'Passwords must match and contain at least 12 characters.', 'error');
    if(!cloud.client) return status('signUpStatus','Supabase setup is required before creating an account.','error');
    busy(e.currentTarget,true);
    try {
      const {data,error}=await cloud.client.auth.signUp({email,password,options:{emailRedirectTo:redirectUrl()}});
      if(error) throw error;
      // An obfuscated user with no session is NOT evidence that an account was created.
      if(data?.session) {
        status('signUpStatus','Signed in. Loading your vaults…','success');
      } else {
        get('verifyEmail').value=email;
        route('verify');
        status('verifyStatus','If a verification is required, you will receive an email. Existing users can sign in or recover access.','success');
      }
    } catch(error) {
      const duplicate = /already registered|already exists/i.test(String(error.message || ''));
      status('signUpStatus', duplicate ? 'An account may already exist. Try signing in or resetting your password.' : (error.message||'Unable to submit registration.'), 'error');
    } finally { get('signUpPassword').value='';get('signUpConfirm').value='';busy(e.currentTarget,false); }
  }
  async function forgot(e) {
    e.preventDefault(); if(!cloud.client) return status('forgotStatus','Supabase configuration required.','error');
    busy(e.currentTarget,true);
    try { const {error}=await cloud.client.auth.resetPasswordForEmail(get('forgotEmail').value.trim(),{redirectTo:redirectUrl()}); if(error) throw error;
      status('forgotStatus','If an account exists for this address, a password reset email will arrive. Check spam too.','success');
    } catch(err) { status('forgotStatus',/rate limit|too many/i.test(err.message||'') ? 'Too many requests. Try again later.' : 'Unable to request reset right now.','error'); }
    finally {busy(e.currentTarget,false);}
  }
  async function resend(e) {
    e.preventDefault(); if(!cloud.client) return status('verifyStatus','Supabase configuration required.','error');
    busy(e.currentTarget,true);
    try { const {error}=await cloud.client.auth.resend({type:'signup',email:get('verifyEmail').value.trim()}); if(error) throw error;
      status('verifyStatus','If verification is pending for this address, an email will arrive.','success');
    } catch(err) {status('verifyStatus',/rate limit|too many/i.test(err.message||'') ? 'Too many requests. Try again later.' : 'Unable to resend right now.','error');}
    finally {busy(e.currentTarget,false);}
  }
  async function reset(e) {
    e.preventDefault();
    if(!recoveryVerified) return status('resetStatus','Recovery link has not been verified. Request a fresh reset email.','error');
    const pwd=get('resetPassword').value;
    if(pwd.length<12 || pwd!==get('resetConfirm').value) return status('resetStatus','Passwords must match and be at least 12 characters.','error');
    if(!cloud.client) return status('resetStatus','Supabase configuration required.','error');
    busy(e.currentTarget,true);
    try {
      const {error}=await cloud.client.auth.updateUser({password:pwd}); if(error) throw error;
      recoveryPending=false; recoveryVerified=false;
      // End the temporary recovery session, requiring normal sign-in.
      const {error:signoutError}=await cloud.client.auth.signOut({scope:'local'});
      if(signoutError) {
        status('resetStatus','Password updated, but automatic sign-out failed. Close this tab and sign out of your account before using this device again.','warning');
        return;
      }
      route('signin');status('accessStatus','Account password updated. Sign in using your new password.','success');
    }catch(err){status('resetStatus', 'Reset link expired or update failed. Request a new reset email.','error');}
    finally{get('resetPassword').value='';get('resetConfirm').value='';busy(e.currentTarget,false);}
  }
  function startRecovery() { recoveryPending=true; recoveryVerified=true; route('reset',false); }
  function readRequested() {return new URL(location.href).searchParams.get('auth')||'signin';}
  function initialize() {
    get('accountSignUpForm').addEventListener('submit',signup);
    get('accountForgotForm').addEventListener('submit',forgot);
    get('verifyResendForm').addEventListener('submit',resend);
    get('accountResetForm').addEventListener('submit',reset);
    document.querySelectorAll('[data-auth-target]').forEach(button=>button.addEventListener('click',()=>{
      if(button.dataset.authTarget==='signup') copyEmail('accessEmail','signUpEmail');
      if(button.dataset.authTarget==='forgot') copyEmail('accessEmail','forgotEmail');
      route(button.dataset.authTarget);
    }));
    get('registerAccountButton').addEventListener('click',()=>{copyEmail('accessEmail','signUpEmail');route('signup');});
    window.addEventListener('popstate',()=>{ if(!uiState.accessGranted)route(readRequested(),false); });
    route(recoveryPending?'reset':readRequested(),false);
  }
  window.PassVaultAuth = { initialize, route, startRecovery, get recoveryPending(){return recoveryPending;} };
})();
