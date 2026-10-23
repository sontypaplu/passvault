(() => {
  'use strict';
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const allowed = new Set(['dark', 'light']);
  const initial = (() => {
    try { const t = sessionStorage.getItem('passvault-theme'); if (allowed.has(t)) return t; } catch {}
    return 'dark';
  })();
  function set(theme) {
    const next = allowed.has(theme) ? theme : 'dark';
    root.dataset.theme = next;
    if(themeColor) themeColor.content = next === 'dark' ? '#090e1b' : '#f5f7fb';
    const premium = document.getElementById('premiumApp');
    premium?.classList.toggle('light', next === 'light');
    const settings = document.getElementById('pv3LightToggle');
    if(settings) { settings.classList.toggle('on', next === 'light'); settings.setAttribute('aria-pressed', String(next === 'light')); }
    const top = document.getElementById('pv3Theme');
    if(top) top.setAttribute('aria-label', next === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(next === 'dark'));
      const symbol = button.querySelector('.theme-symbol');
      const label = button.querySelector('.theme-label');
      if(symbol) symbol.textContent = next === 'dark' ? '☀' : '☾';
      if(label) label.textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
    });
    try { sessionStorage.setItem('passvault-theme', next); } catch {}
  }
  window.PassVaultTheme = { set, toggle: () => set(root.dataset.theme === 'dark' ? 'light' : 'dark') };
  set(initial);
  document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', window.PassVaultTheme.toggle));
})();
