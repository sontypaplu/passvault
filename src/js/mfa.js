/* Mandatory Supabase TOTP: never access encrypted vaults at AAL1.
 * The authenticator secret appears only while the user enrolls; never persisted.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let factorId = null;
  let secret = '';
  let stage = null;
  let activeAccount = null;
  let gatePromise = null;
  const message = (value,kind='') => {
    const target=$('pvMfaStatus');if(target){target.textContent=value;target.dataset.kind=kind;}
  };
  const dialog=()=>$('pvMfaDialog');
  function clearSecrets() {secret='';$('pvMfaSecret').textContent='';$('pvMfaCode').value='';}
  function display() {
    const setup=stage==='enroll';
    $('pvMfaSetup').hidden=!setup;
    $('pvMfaTitle').textContent=setup?'Set up two-factor authentication':'Enter your authenticator code';
    $('pvMfaDescription').textContent=setup
      ? 'This additional factor is mandatory before vault access. Add this secret to a TOTP authenticator and enter its six-digit code.'
      : 'Enter the six-digit code from the authenticator linked to this account.';
    $('pvMfaSecret').textContent=setup?secret:'';
    if(!dialog().open)dialog().showModal();
    $('pvMfaCode').focus();
  }
  async function startEnrollment() {
    const {data,error}=await cloud.client.auth.mfa.enroll({factorType:'totp',friendlyName:'PassVault authenticator'});
    if(error)throw error;
    if(!data?.id||!data.totp?.secret)throw new Error('Authenticator enrollment is unavailable.');
    factorId=data.id;secret=data.totp.secret;stage='enroll';
    display();
    message('Store this secret in your authenticator, then verify the code.');
  }
  async function checkSession(session) {
    if(!session?.user?.id || !cloud.client)return false;
    if(session.user.id!==activeAccount){activeAccount=session.user.id;factorId=null;stage=null;clearSecrets();}
    const {data,error}=await cloud.client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(error||!data)throw new Error('Unable to verify account security level.');
    if(data.currentLevel==='aal2'){
      factorId=null;stage=null;clearSecrets();if(dialog().open)dialog().close();return true;
    }
    const {data:factors,error:factorError}=await cloud.client.auth.mfa.listFactors();
    if(factorError)throw new Error('Unable to load authenticator configuration.');
    const verified=(factors?.totp??[]).find(x=>x.status==='verified');
    if(verified){factorId=verified.id;stage='challenge';clearSecrets();display();return false;}
    if(stage==='enroll'&&factorId){display();return false;}
    await startEnrollment();
    return false;
  }
  async function requireSession(session) {
    if(gatePromise)return gatePromise;
    gatePromise=(async()=>{
      try{return await checkSession(session);}
      catch {stage='error';factorId=null;clearSecrets();display();message('Account security verification is unavailable. Retry signing in or contact support.','error');return false;}
    })();
    try{return await gatePromise;}finally{gatePromise=null;}
  }
  async function verify(event) {
    event.preventDefault();
    if(!cloud.client||!factorId||!['challenge','enroll'].includes(stage))return;
    const code=$('pvMfaCode').value.trim();
    if(!/^[0-9]{6}$/.test(code)){message('Enter an exact six-digit code.','error');return;}
    const submit=$('pvMfaSubmit');submit.disabled=true;
    try {
      message('Verifying authenticator…');
      const {data:challenge,error:challengeError}=await cloud.client.auth.mfa.challenge({factorId});
      if(challengeError||!challenge?.id)throw challengeError||new Error('Unable to issue challenge');
      const {error}=await cloud.client.auth.mfa.verify({factorId,challengeId:challenge.id,code});
      if(error)throw error;
      clearSecrets();factorId=null;stage=null;
      if(dialog().open)dialog().close();
      const {data}=await cloud.client.auth.getSession();
      if(data?.session)await loadAccountVault(data.session);
    } catch(error) {message('Code not verified. Check your authenticator and try again.','error');}
    finally { $('pvMfaCode').value='';submit.disabled=false; }
  }
  async function addBackup() {
    if(!cloud.client||!cloud.userId)return;
    const target=$('pvMfaSettingsStatus');target.textContent='';
    try {
      const {data,error}=await cloud.client.auth.mfa.getAuthenticatorAssuranceLevel();
      if(error||data?.currentLevel!=='aal2')throw new Error('Verify MFA before adding another factor.');
      await startEnrollment();
    } catch {target.textContent='Unable to add another authenticator. Verify the account session and try again.';}
  }
  function reset() {
    activeAccount=null;factorId=null;stage=null;clearSecrets();
    if(dialog().open)dialog().close();
  }
  function initialize() {
    $('pvMfaForm').addEventListener('submit',event=>{void verify(event);});
    $('pvMfaSignOut').addEventListener('click',async()=>{
      try{await cloud.client?.auth.signOut();}finally{reset();await resetCloudUserState();}
    });
    $('pvMfaBackup').addEventListener('click',()=>{void addBackup();});
    dialog().addEventListener('cancel',event=>event.preventDefault());
  }
  window.PassVaultMFA=Object.freeze({initialize,requireSession,reset});
})();
