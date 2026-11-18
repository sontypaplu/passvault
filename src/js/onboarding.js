/* AVENLOCK first-cloud-vault onboarding. No encryption, secrets or tokens are stored here. */
(() => {
  'use strict';
  const POLICY_VERSION = '2026-11-18-v1';
  const el = id => document.getElementById(id);
  let firstVault = false;
  let consentAccepted = false;
  let privacyAvailable = false;
  let inFlight = false;
  let currentUser = null;
  let step = 0;
  let sequence = 0;

  const steps = [
    {label:'STEP 1 OF 3 · CREATE YOUR VAULT',icon:'▦',title:'Give your vault a name.',
     description:'Choose a name, such as Personal or Work. This name is for organization; it is not your password.',
     points:['One secure place for private information','Up to two cloud vaults per account','Your existing workspace opens after setup']},
    {label:'STEP 2 OF 3 · SECURE YOUR DATA',icon:'◇',title:'Protect it with a master password.',
     description:'Your unique master password protects this vault. It is different from your account password and cannot be reset through email.',
     points:['Use a strong, unique master password','Keep it in a secure place','Maintain a verified encrypted backup']},
    {label:'STEP 3 OF 3 · OPEN YOUR WORKSPACE',icon:'✓',title:'Start using your cloud vault.',
     description:'After you create and unlock your vault, AVENLOCK opens your existing workspace.',
     points:['Manage logins and secure notes','Use the existing cloud-sync setting','Keep device-only vaults separate']}
  ];
  function drawStep() {
    const value = steps[step];
    el('alTourStepLabel').textContent = value.label;
    el('alTourIcon').textContent = value.icon;
    el('alTourTitle').textContent = value.title;
    el('alTourDescription').textContent = value.description;
    const list = el('alTourPoints'); list.replaceChildren();
    for (const point of value.points) {
      const li = document.createElement('li'); li.textContent = point; list.append(li);
    }
    document.querySelectorAll('#tourOnboardingScreen [data-al-tour-step]').forEach((item,i)=>item.classList.toggle('active',i===step));
    document.querySelectorAll('#tourOnboardingScreen .al-progress i').forEach((item,i)=>item.classList.toggle('active',i<=step));
    el('alTourBack').textContent = step===0 ? '← Privacy' : '← Previous';
    el('alTourNext').textContent = step===2 ? 'Continue to vault setup →' : 'Next step →';
  }
  function show(page) {
    if (!firstVault || !cloud.userId || cloud.userId !== currentUser || !state.locked) return;
    if (!consentAccepted && page !== 'privacy') return;
    showAccessScreen(page);
    setActiveView();
  }
  async function begin(userId) {
    const token = ++sequence;
    currentUser = userId;
    firstVault = true;
    consentAccepted = false;
    privacyAvailable = false;
    el('alPolicyAgree').checked = false;
    el('alPolicyContinue').disabled = true;
    el('alPolicyStatus').textContent = 'Checking your privacy acknowledgement…';
    step = 0;
    drawStep();
    uiState.accessScreen = 'privacy';
    if (!cloud.client) return;
    try {
      const {data,error} = await cloud.client.from('privacy_consents')
        .select('policy_version').eq('user_id',userId).eq('policy_version',POLICY_VERSION).maybeSingle();
      if (error) throw error;
      if (token !== sequence || currentUser !== cloud.userId) return;
      privacyAvailable = true;
      consentAccepted = !!data;
      el('alPolicyStatus').textContent = '';
      el('alPolicyContinue').textContent = consentAccepted ? 'Back to tour →' : 'Agree & continue to tour →';
      el('alPolicyContinue').disabled = !consentAccepted;
      uiState.accessScreen = consentAccepted ? 'tour' : 'privacy';
    } catch (error) {
      if (token !== sequence || currentUser !== cloud.userId) return;
      // Fail closed for first-vault creation: do not falsely say consent was stored.
      privacyAvailable = false;
      el('alPolicyStatus').textContent = 'Privacy acknowledgement is unavailable. Check your connection and the Supabase privacy_consents migration, then try again.';
      uiState.accessScreen = 'privacy';
    }
  }
  async function accept() {
    if (consentAccepted && firstVault && currentUser === cloud.userId) { show('tour'); return; }
    if (!firstVault || !privacyAvailable || inFlight || !el('alPolicyAgree').checked ||
        !cloud.userId || cloud.userId !== currentUser || !state.locked) return;
    inFlight = true;
    el('alPolicyContinue').disabled = true;
    el('alPolicyStatus').textContent = 'Saving your acknowledgement…';
    const user = currentUser;
    const token = sequence;
    try {
      const {error} = await cloud.client.from('privacy_consents').insert({user_id:user,policy_version:POLICY_VERSION});
      if (error && error.code !== '23505') throw error;
      if (error?.code === '23505') {
        const {data:prior,error:lookupError} = await cloud.client.from('privacy_consents')
          .select('policy_version').eq('user_id',user).eq('policy_version',POLICY_VERSION).maybeSingle();
        if (lookupError || !prior) throw lookupError || new Error('Unable to verify acceptance');
      }
      if (token !== sequence || cloud.userId !== user) return;
      consentAccepted = true;
      el('alPolicyStatus').textContent = '';
      el('alPolicyContinue').textContent = 'Back to tour →';
      show('tour');
    } catch (_) {
      if (token === sequence) el('alPolicyStatus').textContent = 'Could not record your acknowledgement. Check your connection and try again.';
    } finally {
      inFlight = false;
      el('alPolicyContinue').disabled = !privacyAvailable || (!consentAccepted && !el('alPolicyAgree').checked);
    }
  }
  function create() {
    if (!firstVault || !consentAccepted || !cloud.loaded || !state.locked || !cloud.userId) return;
    prepareNewVault(); // Unmodified native vault-creation logic and encryption form.
  }
  function clear() {
    ++sequence; firstVault=false; consentAccepted=false; privacyAvailable=false;
    currentUser=null; inFlight=false; step=0;
    el('alPolicyAgree').checked = false;
    el('alPolicyContinue').disabled = true;
    el('alPolicyStatus').textContent = '';
    el('alPolicyContinue').textContent = 'Agree & continue to tour →';
    el('lockedView').classList.remove('al-first-creation');
    el('alFirstVaultAside').hidden = true;
  }
  function vaultCreated() {
    // Called only after native vault creation has derived encryption and unlocked it.
    clear();
  }
  function home() {
    if (!uiState.accessGranted) { window.PassVaultAuth.route('signin'); return; }
    if (firstVault && state.locked) {
      // Leaving the creation form must not retain a typed master password in hidden fields.
      if (uiState.accessScreen === 'create') {
        clearCreateSensitiveFields();
        cloud.selectedVaultId = null;
      }
      show(consentAccepted ? 'tour' : 'privacy');
      return;
    }
    if (!state.locked) {
      // Click the app's real overview navigation; do not lock, clear, or re-read vault data.
      document.querySelector('#approvedUI .navitem[data-page="overview"]')?.click();
      return;
    }
    displayVaultDashboard();
  }
  function initialize() {
    el('alPolicyAgree').addEventListener('change',() => {
      el('alPolicyContinue').disabled = !privacyAvailable || (!consentAccepted && !el('alPolicyAgree').checked) || inFlight;
    });
    el('alPolicyContinue').addEventListener('click',() => void accept());
    el('alPolicySignOut').addEventListener('click',() => void handleSignOut());
    el('alTourNext').addEventListener('click',() => {if(step<2){step++;drawStep();}else create();});
    el('alTourBack').addEventListener('click',() => {if(step>0){step--;drawStep();}else show('privacy');});
    el('alTourSkip').addEventListener('click',create);
    document.querySelectorAll('[data-avenlock-home]').forEach(brand=>{
      brand.addEventListener('click',home);
      brand.addEventListener('keydown',event=>{
        if(event.key==='Enter' || event.key===' '){event.preventDefault();home();}
      });
    });
    document.querySelectorAll('.al-view-policy').forEach(button => button.addEventListener('click',()=>{
      const dialog=el('alPrivacyDialog');
      el('alPublicPolicyText').replaceChildren(...Array.from(el('alPolicySections').children, child=>child.cloneNode(true)));
      dialog.showModal();
    }));
    el('alClosePrivacy').addEventListener('click',()=>el('alPrivacyDialog').close());
    const back=el('alWorkspaceBack');
    back.addEventListener('click',()=>document.querySelector('#approvedUI .navitem[data-page="overview"]')?.click());
    drawStep();
  }
  window.PassVaultOnboarding = Object.freeze({ begin, clear, isFirstVault:()=>firstVault,
    accepted:()=>consentAccepted, vaultCreated, initialize });
})();
