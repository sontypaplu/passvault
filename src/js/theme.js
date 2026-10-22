(() => {
    const root = document.documentElement;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const applyTheme = (theme) => {
      const dark = theme === 'dark';
      root.dataset.theme = dark ? 'dark' : 'light';
      if (metaTheme) metaTheme.setAttribute('content', dark ? '#0B0E13' : '#F5F7FB');
      document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
        button.setAttribute('aria-pressed', String(dark));
        const symbol = button.querySelector('.theme-symbol');
        const label = button.querySelector('.theme-label');
        if (symbol) symbol.textContent = dark ? '☀' : '☾';
        if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
      });
    };
    applyTheme('light');
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
    });
  })();
