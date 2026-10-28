/* PassVault display preference only. No vault contents, keys, or network calls. */
(() => {
  'use strict';
  const storageKey = 'passvault-text-size-v1';
  const min = 85;
  const max = 125;
  const step = 5;
  const root = document.documentElement;
  const valid = value => Number.isInteger(value) && value >= min && value <= max && (value - min) % step === 0;
  let size = 100;
  try {
    const stored = Number(localStorage.getItem(storageKey));
    if (valid(stored)) size = stored;
  } catch { /* Local storage may be blocked. The slider still works this session. */ }

  const range = document.getElementById('pvTextSizeRange');
  const output = document.getElementById('pvTextSizeValue');
  const reset = document.getElementById('pvTextSizeReset');
  const apply = value => {
    const parsed = Number(value);
    if (!valid(parsed)) return;
    size = parsed;
    root.dataset.pvTextSize = String(size); // fixed, approved CSS selectors; no injected styles
    if (range) {
      range.value = String(size);
      range.setAttribute('aria-valuetext', `${size}%${size === 100 ? ' (default)' : ''}`);
    }
    if (output) output.textContent = `${size}%`;
    try { localStorage.setItem(storageKey, String(size)); } catch { /* display only */ }
  };
  range?.addEventListener('input', () => apply(range.value));
  reset?.addEventListener('click', () => apply(100));
  apply(size);
})();
